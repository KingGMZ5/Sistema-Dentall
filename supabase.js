// Supabase client initialization
const SUPABASE_URL = 'https://hhoktswlmfwlntnmqvey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhob2t0c3dsbWZ3bG50bm1xdmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTgwMjAsImV4cCI6MjA2Mzk3NDAyMH0.0K_sOD8GCRoZgqkbu6Kttyle47ROS3eC5_e-myWtcBk';

// Initialize Supabase client - using a different variable name to avoid naming conflict
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Patient operations
async function getPatients() {
  try {
    const { data, error } = await supabaseClient
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading patients:', error);
    return [];
  }
}

async function addPatient(patient) {
  try {
    console.log('Adding patient to Supabase:', patient);
    const { data, error } = await supabaseClient
      .from('patients')
      .insert([patient])
      .select();
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Patient added successfully to Supabase:', data);
    return data[0];
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
}

async function updatePatient(id, updates) {
  try {
    console.log('Supabase updatePatient called with:', { id, updates });
    const { data, error } = await supabaseClient
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
    console.log('Supabase update successful:', data);
    return data[0];
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
}

async function deletePatient(id) {
  try {
    // First, get all invoices for this patient
    const { data: invoices, error: invoicesError } = await supabaseClient
      .from('invoices')
      .select('id')
      .eq('patient_id', id);
    
    if (invoicesError) throw invoicesError;
    
    console.log(`Found ${invoices ? invoices.length : 0} invoices for patient ${id}`);
    
    // Delete all invoices for the patient first
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(invoice => invoice.id);
      console.log('Deleting invoices with IDs:', invoiceIds);
      
      const { error: deleteInvoicesError } = await supabaseClient
        .from('invoices')
        .delete()
        .in('id', invoiceIds);
      
      if (deleteInvoicesError) throw deleteInvoicesError;
      console.log('Successfully deleted patient invoices');
    }
    
    // Now we can safely delete the patient
    const { error } = await supabaseClient
      .from('patients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    console.log('Successfully deleted patient');
    return true;
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
}

// Service operations
async function getServices() {
  try {
    const { data, error } = await supabaseClient
      .from('services')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading services:', error);
    return [];
  }
}

async function addService(service) {
  try {
    const { data, error } = await supabaseClient
      .from('services')
      .insert([service])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
}

async function updateService(id, updates) {
  try {
    const { data, error } = await supabaseClient
      .from('services')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
}

async function deleteService(id) {
  try {
    const { error } = await supabaseClient
      .from('services')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
}

// Invoice operations
async function saveInvoice(invoice) {
  try {
    const { data, error } = await supabaseClient
      .from('invoices')
      .insert([invoice])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error saving invoice:', error);
    throw error;
  }
}

async function getPatientInvoices(patientId) {
  try {
    const { data, error } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading patient invoices:', error);
    return [];
  }
}

// Create database tables if they don't exist
async function initializeDatabase() {
  try {
    // Check if tables exist by querying them
    const { data: patientsExists } = await supabaseClient.from('patients').select('count', { count: 'exact', head: true });
    const { data: servicesExists } = await supabaseClient.from('services').select('count', { count: 'exact', head: true });
    const { data: invoicesExists } = await supabaseClient.from('invoices').select('count', { count: 'exact', head: true });
    
    console.log('Database connection successful. Tables exist:', {
      patients: !!patientsExists,
      services: !!servicesExists,
      invoices: !!invoicesExists
    });
    
    // If tables don't exist, they will be created automatically by Supabase
    // We can initialize with default data if needed
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Export functions
window.supabaseClient = {
  getPatients,
  addPatient,
  updatePatient,
  deletePatient,
  getServices,
  addService,
  updateService,
  deleteService,
  saveInvoice,
  getPatientInvoices,
  initializeDatabase
};