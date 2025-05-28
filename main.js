// Wait for DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
  // Show loading animation for 1.5 seconds
  setTimeout(function() {
    document.querySelector('.loader-container').classList.add('fade-out');
    setTimeout(function() {
      document.querySelector('.loader-container').style.display = 'none';
    }, 500);
  }, 1500);

  // Initialize theme switcher
  initThemeSwitcher();
  
  // Initialize scroll to top button
  initScrollToTop();
  
  // Initialize animations
  initAnimations();
  
  // Initialize data 
  loadSavedData();
  
  // Event listeners for forms
  document.getElementById('add-patient-btn').addEventListener('click', addPatient);
  document.getElementById('add-service-btn').addEventListener('click', addService);
  document.getElementById('generate-invoice-btn').addEventListener('click', generateInvoice);
  
  // Birth date change listener to calculate age and enable/disable cedula
  document.getElementById('patient-birthdate').addEventListener('change', handleBirthdateChange);
  
  // Search button event listener is now handled via onclick in HTML
});

// Theme switcher
function initThemeSwitcher() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle.querySelector('i');
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
  }
  
  // Theme toggle event listener
  themeToggle.addEventListener('click', function() {
    if (document.body.hasAttribute('data-theme')) {
      document.body.removeAttribute('data-theme');
      themeIcon.classList.replace('fa-sun', 'fa-moon');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
      localStorage.setItem('theme', 'dark');
    }
  });
}

// Scroll to top button
function initScrollToTop() {
  const scrollTopBtn = document.getElementById('scroll-top');
  
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });
  
  scrollTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Animations
function initAnimations() {
  const animatedElements = document.querySelectorAll('.animate-fade-in-up');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  animatedElements.forEach(element => {
    observer.observe(element);
  });
}

// Data management
let patients = [];
let services = [];

async function loadSavedData() {
  try {
    // Initialize database
    await window.supabaseClient.initializeDatabase();
    
    // Load patients and services from Supabase
    const rawPatients = await window.supabaseClient.getPatients();
    const rawServices = await window.supabaseClient.getServices();
    
    // Convert database field names to frontend field names for patients
    patients = rawPatients.map(patient => {
      // For backward compatibility with old patients without birthdate
      let birthdate = patient.birthdate;
      if (!birthdate && patient.age) {
        // Estimate birthdate from age (for display purposes only)
        const today = new Date();
        birthdate = new Date(today.getFullYear() - patient.age, today.getMonth(), today.getDate()).toISOString().split('T')[0];
      }
      
      return {
        ...patient,
        lastVisit: patient.last_visit,
        totalSpent: patient.total_spent || 0,
        birthdate: birthdate,
        // Calculate current age if birthdate is available
        age: birthdate ? calculateAge(birthdate) : (patient.age || 0)
      };
    });
    
    services = rawServices;
    
    updatePatientList();
    updateServiceList();
    updatePatientSelect();
    updateDashboardStats();
    
    showNotification('success', 'Datos cargados', 'Conexión con Supabase establecida correctamente');
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification('error', 'Error de conexión', 'No se pudieron cargar los datos desde Supabase');
    
    // Fallback to localStorage if Supabase fails
    patients = JSON.parse(localStorage.getItem('patients')) || [];
    services = JSON.parse(localStorage.getItem('services')) || [];
    
    updatePatientList();
    updateServiceList();
    updatePatientSelect();
    updateDashboardStats();
  }
}

function saveData() {
  // Store in localStorage as backup
  localStorage.setItem('patients', JSON.stringify(patients));
  localStorage.setItem('services', JSON.stringify(services));
}

// Function to calculate age from birthdate
function calculateAge(birthdate) {
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Handle birthdate changes to toggle cedula field
function handleBirthdateChange() {
  const birthdateInput = document.getElementById('patient-birthdate');
  const idInput = document.getElementById('patient-id');
  
  if (birthdateInput.value) {
    const age = calculateAge(birthdateInput.value);
    
    // Disable cedula field if under 18
    if (age < 18) {
      idInput.disabled = true;
      idInput.placeholder = 'No requerido para menores de edad';
    } else {
      idInput.disabled = false;
      idInput.placeholder = 'Número de cédula';
    }
  }
}

// Patient management
async function addPatient() {
  const name = document.getElementById('patient-name').value;
  const lastname = document.getElementById('patient-lastname').value;
  const birthdate = document.getElementById('patient-birthdate').value;
  const id = document.getElementById('patient-id').value || '0';  // Default to '0' if empty
  const email = document.getElementById('patient-email').value || '0';  // Default to '0' if empty
  const phone = document.getElementById('patient-phone').value || '0';  // Default to '0' if empty
  
  // Calculate age from birthdate
  const age = birthdate ? calculateAge(birthdate) : 0;
  
  if (name && lastname && birthdate) {  // Only name, lastname and birthdate are required
    const patientCode = generatePatientCode();
    
    // Create patient object for Supabase (without birthdate if not supported)
    const supabasePatient = {
      code: patientCode,
      name,
      lastname,
      age,       // Store calculated age
      id_number: id,
      email,
      phone,
      last_visit: null,
      total_spent: 0
    };
    
    // Create patient object for local storage (with birthdate)
    const localPatient = {
      ...supabasePatient,
      birthdate // Store birthdate locally
    };
    
    try {
      // Add patient to Supabase (without birthdate field)
      const savedPatient = await window.supabaseClient.addPatient(supabasePatient);
      
      // Update local data
      // For display purposes, map the database field names back to the frontend names
      const frontendPatient = savedPatient ? {
        ...savedPatient,
        id: savedPatient.id,  // Keep the Supabase ID
        lastVisit: savedPatient.last_visit,
        totalSpent: savedPatient.total_spent,
        birthdate: birthdate  // Add birthdate to the Supabase response
      } : localPatient;
      
      patients.push(frontendPatient);
      saveData();
      updatePatientList();
      updatePatientSelect();
      updateDashboardStats();
      resetPatientForm();
      
      showNotification('success', '¡Paciente agregado!', `${name} ${lastname} ha sido registrado exitosamente.`);
    } catch (error) {
      console.error('Error adding patient to Supabase:', error);
      
      // Fallback to localStorage only
      // Convert back to frontend naming convention for the patient object
      const frontendPatient = {
        ...localPatient,
        id: null,  // No Supabase ID since save failed
        lastVisit: null,
        totalSpent: 0
      };
      
      patients.push(frontendPatient);
      saveData();
      updatePatientList();
      updatePatientSelect();
      updateDashboardStats();
      resetPatientForm();
      
      showNotification('warning', 'Sincronización pendiente', `${name} ${lastname} ha sido registrado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  } else {
    showNotification('error', 'Error', 'Por favor complete al menos el nombre, apellido y fecha de nacimiento del paciente.');
  }
}

async function deletePatient(index) {
  if (confirm('¿Seguro que deseas eliminar este paciente?')) {
    const patient = patients[index];
    const patientName = `${patient.name} ${patient.lastname}`;
    
    try {
      // If the patient has an id (from Supabase), delete from database
      if (patient.id) {
        console.log('Deleting patient with ID:', patient.id);
        await window.supabaseClient.deletePatient(patient.id);
      } else {
        console.log('No Supabase ID found for patient:', patient);
      }
      
      // Remove from local array
      patients.splice(index, 1);
      saveData();
      updatePatientList();
      updatePatientSelect();
      updateDashboardStats();
      
      showNotification('success', 'Paciente eliminado', `${patientName} ha sido eliminado correctamente.`);
    } catch (error) {
      console.error('Error deleting patient from Supabase:', error);
      
      // Fallback to local deletion only
      patients.splice(index, 1);
      saveData();
      updatePatientList();
      updatePatientSelect();
      updateDashboardStats();
      
      showNotification('warning', 'Sincronización pendiente', `${patientName} ha sido eliminado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  }
}

function updatePatientList() {
  const patientList = document.getElementById('added-patients-list');
  patientList.innerHTML = '';
  
  patients.forEach((patient, index) => {
    // Calculate current age if birthdate is available
    const currentAge = patient.birthdate ? calculateAge(patient.birthdate) : (patient.age || 0);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${patient.code}</td>
      <td>${patient.name}</td>
      <td>${patient.lastname}</td>
      <td>${currentAge}</td>
      <td>${patient.id_number !== '0' ? patient.id_number : 'N/A'}</td>
      <td>${patient.email !== '0' ? patient.email : 'N/A'}</td>
      <td>${patient.phone !== '0' ? patient.phone : 'N/A'}</td>
      <td>$${patient.totalSpent ? patient.totalSpent.toFixed(2) : '0.00'}</td>
      <td>
        <div class="table-action">
          <button class="button accent-button btn-sm" onclick="viewPatientDetails(${index})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="button danger-button btn-sm" onclick="deletePatient(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    patientList.appendChild(row);
  });
}

function updatePatientSelect() {
  const select = document.getElementById('selected-patient');
  select.innerHTML = '<option value="">Seleccione un paciente</option>';
  
  patients.forEach((patient, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${patient.code} - ${patient.name} ${patient.lastname}`;
    select.appendChild(option);
  });
}

function resetPatientForm() {
  document.getElementById('patient-name').value = '';
  document.getElementById('patient-lastname').value = '';
  document.getElementById('patient-birthdate').value = '';
  document.getElementById('patient-id').value = '';
  document.getElementById('patient-email').value = '';
  document.getElementById('patient-phone').value = '';
  
  // Re-enable cedula field
  document.getElementById('patient-id').disabled = false;
  document.getElementById('patient-id').placeholder = 'Número de cédula';
}

function generatePatientCode() {
  // Find the maximum code number used so far
  let maxCodeNumber = 0;
  patients.forEach(patient => {
    // Extract the numeric part of the code (after 'P')
    const codeNumber = parseInt(patient.code.substring(1));
    if (!isNaN(codeNumber) && codeNumber > maxCodeNumber) {
      maxCodeNumber = codeNumber;
    }
  });
  
  // Increment the maximum code number by 1
  const nextCodeNumber = maxCodeNumber + 1;
  
  // Format the code with leading zeros
  return 'P' + ('00000' + nextCodeNumber).slice(-5);
}

// Service management
async function addService() {
  const name = document.getElementById('service-name').value;
  const price = document.getElementById('service-price').value;
  
  if (name && price) {
    const service = {
      name,
      price: parseFloat(price)
    };
    
    try {
      // Add service to Supabase
      const savedService = await window.supabaseClient.addService(service);
      
      // Update local data
      services.push(savedService || service);
      saveData();
      updateServiceList();
      resetServiceForm();
      
      showNotification('success', 'Servicio agregado', `${name} ha sido agregado a la lista de servicios.`);
    } catch (error) {
      console.error('Error adding service to Supabase:', error);
      
      // Fallback to localStorage only
      services.push(service);
      saveData();
      updateServiceList();
      resetServiceForm();
      
      showNotification('warning', 'Sincronización pendiente', `${name} ha sido agregado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  } else {
    showNotification('error', 'Error', 'Por favor complete todos los campos del servicio.');
  }
}

async function deleteService(index) {
  if (confirm('¿Seguro que deseas eliminar este servicio?')) {
    const service = services[index];
    const serviceName = service.name;
    
    try {
      // If the service has an id (from Supabase), delete from database
      if (service.id) {
        await window.supabaseClient.deleteService(service.id);
      }
      
      // Remove from local array
      services.splice(index, 1);
      saveData();
      updateServiceList();
      
      showNotification('success', 'Servicio eliminado', `${serviceName} ha sido eliminado correctamente.`);
    } catch (error) {
      console.error('Error deleting service from Supabase:', error);
      
      // Fallback to local deletion only
      services.splice(index, 1);
      saveData();
      updateServiceList();
      
      showNotification('warning', 'Sincronización pendiente', `${serviceName} ha sido eliminado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  }
}

function updateServiceList() {
  const serviceList = document.getElementById('service-list');
  const serviceCheckboxes = document.getElementById('service-checkboxes');
  
  serviceList.innerHTML = '';
  serviceCheckboxes.innerHTML = '';
  
  services.forEach((service, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${service.name}</td>
      <td>$${service.price.toFixed(2)}</td>
      <td>
        <button class="button danger-button btn-sm" onclick="deleteService(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    serviceList.appendChild(row);
    
    // Checkbox for invoice generation
    const checkbox = document.createElement('div');
    checkbox.className = 'service-checkbox';
    checkbox.innerHTML = `
      <input type="checkbox" id="service-checkbox-${index}" value="${index}" class="checkbox-input">
      <div class="service-info">
        <div class="service-name">${service.name}</div>
        <div class="service-price">$${service.price.toFixed(2)}</div>
        <div class="service-quantity-container">
          <label for="service-invoice-quantity-${index}">Cantidad:</label>
          <input type="number" id="service-invoice-quantity-${index}" min="1" value="1" class="form-control quantity-input">
        </div>
      </div>
    `;
    serviceCheckboxes.appendChild(checkbox);
  });
}

function resetServiceForm() {
  document.getElementById('service-name').value = '';
  document.getElementById('service-price').value = '';
}

// Invoice generation
async function generateInvoice() {
  const patientIndex = document.getElementById('selected-patient').value;
  const selectedServices = Array.from(document.querySelectorAll('#service-checkboxes input:checked'));
  const applyItbis = document.getElementById('apply-itbis').checked;
  const discount = parseFloat(document.getElementById('discount').value) || 0;
  
  if (patientIndex && selectedServices.length > 0) {
    const patient = patients[patientIndex];
    patient.lastVisit = new Date().toLocaleDateString();
    
    let total = 0;
    const serviceDetails = selectedServices.map(checkbox => {
      const serviceIndex = checkbox.value;
      const service = services[serviceIndex];
      // Get quantity from the invoice section, not from the service list
      const quantityInput = document.getElementById(`service-invoice-quantity-${serviceIndex}`);
      const quantity = parseInt(quantityInput ? quantityInput.value : 1) || 1;
      const serviceTotal = service.price * quantity;
      
      total += serviceTotal;
      
      return {
        name: service.name,
        price: service.price,
        quantity: quantity,
        total: serviceTotal
      };
    });
    
    // Calculate totals
    const subtotal = total;
    total -= discount;
    
    let itbisAmount = 0;
    if (applyItbis) {
      itbisAmount = total * 0.05;
      total += itbisAmount;
    }
    
    // Update patient total spent
    patient.totalSpent = (patient.totalSpent || 0) + total;
    console.log(`Updating patient total spent: ${patient.totalSpent} (${patient.name})`);
    
    
    try {
      // If patient has an id (from Supabase), update in database
      if (patient.id) {
        console.log(`Saving to Supabase: Patient ID ${patient.id}, Total: ${patient.totalSpent}`);
        await window.supabaseClient.updatePatient(patient.id, {
          last_visit: patient.lastVisit,
          total_spent: patient.totalSpent
        });
      }
      
      // Save invoice to Supabase
      const invoiceData = {
        patient_id: patient.id,
        patient_code: patient.code,
        patient_name: `${patient.name} ${patient.lastname}`,
        subtotal,
        discount,
        itbis: itbisAmount,
        total,
        services: serviceDetails,
        created_at: new Date().toISOString()
      };
      
      await window.supabaseClient.saveInvoice(invoiceData);
      
      saveData();
      updatePatientList();
      updateDashboardStats();
      
      // Generate invoice HTML
      generateInvoicePreview(patient, serviceDetails, subtotal, discount, itbisAmount, total);
      
      showNotification('success', 'Presupuesto generado', `El presupuesto para ${patient.name} ${patient.lastname} ha sido generado y guardado en la base de datos.`);
    } catch (error) {
      console.error('Error saving invoice to Supabase:', error);
      
      // Fallback to local update only
      saveData();
      updatePatientList();
      updateDashboardStats();
      
      // Generate invoice HTML
      generateInvoicePreview(patient, serviceDetails, subtotal, discount, itbisAmount, total);
      
      showNotification('warning', 'Sincronización pendiente', `El presupuesto para ${patient.name} ${patient.lastname} ha sido generado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  } else {
    showNotification('error', 'Error', 'Debe seleccionar un paciente y al menos un servicio.');
  }
}

function generateInvoicePreview(patient, serviceDetails, subtotal, discount, itbisAmount, total) {
  const invoiceOutput = document.getElementById('invoice-output');
  
  // Check if email is available (not '0')
  const hasValidEmail = patient.email && patient.email !== '0';
  
  const invoiceHTML = `
    <div class="invoice-preview animate-fade-in-up">
      <div class="invoice-header">
        <div>
          <div class="invoice-title">PRESUPUESTO</div>
          <div class="invoice-date">Fecha: ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="invoice-company">
          <h3>Dra. Pamela Guzmán</h3>
          <p>Periodoncia e Implantes</p>
          <p>Tel: +1-829-830-6842</p>
        </div>
      </div>
      
      <div class="invoice-customer">
        <h4><i class="fas fa-user"></i> Información del Paciente</h4>
        <div class="form-row">
          <div>
            <p><strong>Código:</strong> ${patient.code}</p>
            <p><strong>Nombre:</strong> ${patient.name} ${patient.lastname}</p>
          </div>
          <div>
            <p><strong>Cédula:</strong> ${patient.id_number !== '0' ? patient.id_number : 'N/A'}</p>
            <p><strong>Email:</strong> ${patient.email !== '0' ? patient.email : 'N/A'}</p>
          </div>
          <div>
            <p><strong>Teléfono:</strong> ${patient.phone !== '0' ? patient.phone : 'N/A'}</p>
            <p><strong>Última Visita:</strong> ${patient.lastVisit || 'No registrada'}</p>
          </div>
        </div>
      </div>
      
      <div class="invoice-services">
        <h4><i class="fas fa-tooth"></i> Servicios</h4>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Precio</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${serviceDetails.map(detail => `
                <tr>
                  <td>${detail.name}</td>
                  <td>$${detail.price.toFixed(2)}</td>
                  <td>${detail.quantity}</td>
                  <td>$${detail.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="invoice-totals">
        <div class="invoice-total-column">
          <div class="invoice-total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          
          ${discount > 0 ? `
            <div class="invoice-total-row">
              <span>Descuento:</span>
              <span>-$${discount.toFixed(2)}</span>
            </div>
          ` : ''}
          
          ${itbisAmount > 0 ? `
            <div class="invoice-total-row">
              <span>ITBIS (5%):</span>
              <span>$${itbisAmount.toFixed(2)}</span>
            </div>
          ` : ''}
          
          <div class="invoice-total-row grand-total">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div class="text-center mt-4">
        <button class="button primary-button" onclick="downloadPDF()">
          <i class="fas fa-file-pdf"></i> Descargar PDF
        </button>
        <button class="button secondary-button ${!hasValidEmail ? 'disabled' : ''}" 
                onclick="${hasValidEmail ? 'sendInvoiceByEmail()' : ''}"
                ${!hasValidEmail ? 'disabled' : ''}>
          <i class="fas fa-envelope"></i> Enviar por Email
          ${!hasValidEmail ? '<span class="tooltip-text">El paciente no tiene correo electrónico</span>' : ''}
        </button>
      </div>
    </div>
  `;
  
  invoiceOutput.innerHTML = invoiceHTML;
}

// Download PDF functionality with jsPDF
function downloadPDF() {
  showNotification('info', 'Generando PDF', 'El PDF se está generando y descargará en breve...');
  
  console.log('Starting PDF generation');
  
  // Get jsPDF from the window object
  if (!window.jspdf) {
    console.error('jsPDF library not found on window object');
    showNotification('error', 'Error', 'No se pudo cargar la biblioteca jsPDF.');
    return;
  }
  
  const jsPDF = window.jspdf.jsPDF;
  
  // Get patient data
  const patientIndex = document.getElementById('selected-patient').value;
  if (!patientIndex) {
    showNotification('error', 'Error', 'No hay paciente seleccionado para generar el PDF.');
    return;
  }
  
  const patient = patients[patientIndex];
  
  // Create new PDF document
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(156, 39, 176); // Purple color
  
  // Header
  doc.text('PRESUPUESTO', 105, 30, null, null, 'center');
  doc.setFontSize(12);
  doc.text('Dra. Pamela Guzmán - Periodoncia e Implantes', 105, 40, null, null, 'center');
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 105, 50, null, null, 'center');
  
  // Patient information
  doc.setFillColor(245, 245, 255);
  doc.rect(15, 60, 180, 40, 'F');
  
  doc.setFontSize(14);
  doc.setTextColor(156, 39, 176);
  doc.text('Información del Paciente', 20, 70);
  
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Código: ${patient.code}`, 20, 80);
  doc.text(`Nombre: ${patient.name} ${patient.lastname}`, 20, 87);
  doc.text(`Cédula: ${patient.id_number || patient.id}`, 20, 94);
  
  doc.text(`Email: ${patient.email}`, 110, 80);
  doc.text(`Teléfono: ${patient.phone}`, 110, 87);
  doc.text(`Última Visita: ${patient.lastVisit}`, 110, 94);
  
  // Get services information
  const selectedServices = Array.from(document.querySelectorAll('#service-checkboxes input:checked'));
  const applyItbis = document.getElementById('apply-itbis').checked;
  const discount = parseFloat(document.getElementById('discount').value) || 0;
  
  // Calculate service details and totals
  let total = 0;
  const serviceDetails = selectedServices.map(checkbox => {
    const serviceIndex = checkbox.value;
    const service = services[serviceIndex];
    const quantity = parseInt(document.getElementById(`service-invoice-quantity-${serviceIndex}`).value) || 1;
    const serviceTotal = service.price * quantity;
    
    total += serviceTotal;
    
    return {
      name: service.name,
      price: service.price,
      quantity: quantity,
      total: serviceTotal
    };
  });
  
  // Calculate totals
  const subtotal = total;
  total -= discount;
  
  let itbisAmount = 0;
  if (applyItbis) {
    itbisAmount = total * 0.05;
    total += itbisAmount;
  }
  
  // Services table
  doc.setFillColor(156, 39, 176);
  doc.setTextColor(255, 255, 255);
  doc.rect(15, 110, 180, 10, 'F');
  doc.text('Servicio', 20, 117);
  doc.text('Precio', 100, 117);
  doc.text('Cantidad', 130, 117);
  doc.text('Total', 170, 117);
  
  let y = 130;
  doc.setTextColor(80, 80, 80);
  
  serviceDetails.forEach((detail, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 255);
      doc.rect(15, y - 7, 180, 10, 'F');
    }
    doc.text(detail.name, 20, y);
    doc.text(`$${detail.price.toFixed(2)}`, 100, y);
    doc.text(`${detail.quantity}`, 130, y);
    doc.text(`$${detail.total.toFixed(2)}`, 170, y);
    y += 10;
  });
  
  // Totals
  y += 10;
  doc.line(15, y, 195, y);
  y += 10;
  
  doc.text('Subtotal:', 130, y);
  doc.text(`$${subtotal.toFixed(2)}`, 170, y);
  y += 10;
  
  if (discount > 0) {
    doc.text('Descuento:', 130, y);
    doc.text(`-$${discount.toFixed(2)}`, 170, y);
    y += 10;
  }
  
  if (applyItbis) {
    doc.text('ITBIS (5%):', 130, y);
    doc.text(`$${itbisAmount.toFixed(2)}`, 170, y);
    y += 10;
  }
  
  doc.setFillColor(156, 39, 176);
  doc.rect(110, y, 85, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('TOTAL:', 130, y + 8);
  doc.text(`$${total.toFixed(2)}`, 170, y + 8);
  
  // Footer
  y = 270;
  doc.setTextColor(156, 39, 176);
  doc.setFontSize(10);
  doc.text('Gracias por su preferencia', 105, y, null, null, 'center');
  
  // Save the PDF
  const pdfName = `Presupuesto_${patient.name}_${new Date().getTime()}.pdf`;
  doc.save(pdfName);
  
  showNotification('success', 'PDF Generado', `El presupuesto para ${patient.name} ${patient.lastname} ha sido descargado como PDF.`);
}

// Send email functionality with EmailJS
function sendInvoiceByEmail() {
  // Get patient data
  const patientIndex = document.getElementById('selected-patient').value;
  if (!patientIndex) {
    showNotification('error', 'Error', 'No hay paciente seleccionado para enviar el email.');
    return;
  }
  
  const patient = patients[patientIndex];
  
  showModal({
    title: 'Enviar Presupuesto',
    content: `
      <p>¿Desea enviar este presupuesto por correo electrónico al paciente?</p>
      <div class="form-group">
        <label for="email-subject">Asunto:</label>
        <input type="text" id="email-subject" class="form-control" value="Presupuesto - Dra. Pamela Guzmán">
      </div>
      <div class="form-group">
        <label for="email-message">Mensaje:</label>
        <textarea id="email-message" class="form-control" rows="4">Estimado/a ${patient.name} ${patient.lastname},

Adjunto encontrará su presupuesto dental. Si tiene alguna pregunta o desea agendar una cita, no dude en contactarnos.

Saludos cordiales,
Dra. Pamela Guzmán
Periodoncia e Implantes</textarea>
      </div>
    `,
    confirmText: 'Enviar',
    cancelText: 'Cancelar',
    onConfirm: () => {
      showNotification('info', 'Enviando email', 'El presupuesto está siendo enviado...');
      
      // First, generate PDF with jsPDF
      if (!window.jspdf) {
        console.error('jsPDF library not found on window object');
        showNotification('error', 'Error', 'No se pudo cargar la biblioteca jsPDF.');
        return;
      }
      
      const jsPDF = window.jspdf.jsPDF;
      
      // Create PDF
      const doc = new jsPDF();
      
      // Get selected services, apply ITBIS, discount, etc.
      const selectedServices = Array.from(document.querySelectorAll('#service-checkboxes input:checked'));
      const applyItbis = document.getElementById('apply-itbis').checked;
      const discount = parseFloat(document.getElementById('discount').value) || 0;
      
      // Calculate service details and totals
      let total = 0;
      const serviceDetails = selectedServices.map(checkbox => {
        const serviceIndex = checkbox.value;
        const service = services[serviceIndex];
        const quantity = parseInt(document.getElementById(`service-invoice-quantity-${serviceIndex}`).value) || 1;
        const serviceTotal = service.price * quantity;
        
        total += serviceTotal;
        
        return {
          name: service.name,
          price: service.price,
          quantity: quantity,
          total: serviceTotal
        };
      });
      
      // Calculate totals
      const subtotal = total;
      total -= discount;
      
      let itbisAmount = 0;
      if (applyItbis) {
        itbisAmount = total * 0.05;
        total += itbisAmount;
      }
      
      // Generate PDF content (simplified version of downloadPDF function)
      doc.setFontSize(22);
      doc.setTextColor(156, 39, 176); // Purple color
      
      doc.text('PRESUPUESTO', 105, 30, null, null, 'center');
      doc.setFontSize(12);
      doc.text('Dra. Pamela Guzmán - Periodoncia e Implantes', 105, 40, null, null, 'center');
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 105, 50, null, null, 'center');
      
      // Basic patient information
      doc.setFontSize(14);
      doc.text('Información del Paciente', 20, 70);
      doc.setFontSize(11);
      doc.text(`Nombre: ${patient.name} ${patient.lastname}`, 20, 80);
      doc.text(`Total: $${total.toFixed(2)}`, 20, 90);
      
      // Save PDF as blob
      const pdfBlob = doc.output('blob');
      
      // Convert PDF blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = function() {
        // Get the base64 string (remove the data URL prefix)
        const base64data = reader.result.split(',')[1];
        
        // Get message from modal
        const emailSubject = document.getElementById('email-subject').value;
        const emailMessage = document.getElementById('email-message').value;
        
        // Set up EmailJS parameters
        const templateParams = {
          to_email: patient.email,
          to_name: `${patient.name} ${patient.lastname}`,
          from_name: 'Dra. Pamela Guzmán',
          subject: emailSubject,
          message: emailMessage,
          pdf_base64: base64data,
          pdf_name: `Presupuesto_${patient.name}.pdf`,
          total_amount: total.toFixed(2)
        };
        
        // Send email with EmailJS
        emailjs.send('service_lyaqyso', 'template_izwblnk', templateParams)
          .then(function(response) {
            console.log('EMAIL ENVIADO:', response.status, response.text);
            showNotification('success', 'Email enviado', `El presupuesto ha sido enviado exitosamente a ${patient.email}`);
          })
          .catch(function(error) {
            console.error('ERROR AL ENVIAR EMAIL:', error);
            showNotification('error', 'Error al enviar email', 'Ha ocurrido un error al enviar el email. Por favor, intente de nuevo.');
          });
      };
    }
  });
}

// Dashboard statistics
function updateDashboardStats() {
  // Update total patients stat
  const totalPatientsElement = document.getElementById('total-patients');
  if (totalPatientsElement) {
    totalPatientsElement.textContent = patients.length;
  }
  
  // Update total services stat
  const totalServicesElement = document.getElementById('total-services');
  if (totalServicesElement) {
    totalServicesElement.textContent = services.length;
  }
  
  // Calculate total revenue
  const totalRevenue = patients.reduce((sum, patient) => sum + (patient.totalSpent || 0), 0);
  
  // Update total revenue stat
  const totalRevenueElement = document.getElementById('total-revenue');
  if (totalRevenueElement) {
    totalRevenueElement.textContent = `$${totalRevenue.toFixed(2)}`;
  }
}

// Utility functions
function showNotification(type, title, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';
  
  // Set notification content
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas ${iconClass}"></i>
    </div>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <p class="notification-message">${message}</p>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.classList.add('active');
  }, 10);
  
  // Hide and remove notification after 5 seconds
  setTimeout(() => {
    notification.classList.remove('active');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

function showModal(options) {
  // Create modal elements
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  // Build footer buttons HTML
  let footerHTML = '';
  
  // Add custom buttons if provided
  if (options.customButtons && options.customButtons.length > 0) {
    options.customButtons.forEach((button, index) => {
      footerHTML += `<button class="button ${button.class || 'accent-button'}" id="modal-custom-${index}">${button.text}</button>`;
    });
  }
  
  // Add standard buttons
  if (options.cancelText) {
    footerHTML += `<button class="button secondary-button" id="modal-cancel">${options.cancelText}</button>`;
  }
  
  footerHTML += `<button class="button primary-button" id="modal-confirm">${options.confirmText || 'Confirmar'}</button>`;
  
  // Set modal content
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${options.title}</h3>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      ${options.content}
    </div>
    <div class="modal-footer">
      ${footerHTML}
    </div>
  `;
  
  modalBackdrop.appendChild(modal);
  document.body.appendChild(modalBackdrop);
  
  // Show modal
  setTimeout(() => {
    modalBackdrop.classList.add('active');
  }, 10);
  
  // Close button event
  modal.querySelector('.modal-close').addEventListener('click', () => {
    closeModal(modalBackdrop);
  });
  
  // Cancel button event
  if (options.cancelText) {
    modal.querySelector('#modal-cancel').addEventListener('click', () => {
      closeModal(modalBackdrop);
      if (options.onCancel) options.onCancel();
    });
  }
  
  // Confirm button event
  modal.querySelector('#modal-confirm').addEventListener('click', () => {
    closeModal(modalBackdrop);
    if (options.onConfirm) options.onConfirm();
  });
  
  // Custom buttons events
  if (options.customButtons && options.customButtons.length > 0) {
    options.customButtons.forEach((button, index) => {
      modal.querySelector(`#modal-custom-${index}`).addEventListener('click', () => {
        if (button.closeOnClick !== false) {
          closeModal(modalBackdrop);
        }
        if (button.action) button.action();
      });
    });
  }
}

function closeModal(modalBackdrop) {
  modalBackdrop.classList.remove('active');
  setTimeout(() => {
    modalBackdrop.remove();
  }, 300);
}

// Function to view patient details
function viewPatientDetails(index) {
  const patient = patients[index];
  
  // For debugging - log the patient object to see its structure
  console.log('Patient details:', patient);
  
  // Calculate current age if birthdate is available
  const currentAge = patient.birthdate ? calculateAge(patient.birthdate) : (patient.age || 0);
  
  showModal({
    title: 'Detalles del Paciente',
    content: `
      <div class="patient-details">
        <div class="form-row">
          <div class="form-group">
            <label>Código</label>
            <p>${patient.code}</p>
          </div>
          <div class="form-group">
            <label>Nombre Completo</label>
            <p>${patient.name} ${patient.lastname}</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha de Nacimiento</label>
            <p>${patient.birthdate ? new Date(patient.birthdate).toLocaleDateString() : 'No disponible'}</p>
          </div>
          <div class="form-group">
            <label>Edad</label>
            <p>${currentAge} años</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Cédula</label>
            <p>${patient.id_number !== '0' ? patient.id_number : 'No disponible'}</p>
          </div>
          <div class="form-group">
            <label>Email</label>
            <p>${patient.email !== '0' ? patient.email : 'No disponible'}</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <p>${patient.phone !== '0' ? patient.phone : 'No disponible'}</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Última Visita</label>
            <p>${patient.lastVisit || 'No registrada'}</p>
          </div>
          <div class="form-group">
            <label>Total Presupuestado</label>
            <p>$${patient.totalSpent ? patient.totalSpent.toFixed(2) : '0.00'}</p>
          </div>
        </div>
      </div>
    `,
    confirmText: 'Cerrar',
    cancelText: 'Seleccionar',
    customButtons: [{
      text: 'Editar',
      class: 'accent-button',
      action: () => openEditPatientModal(index)
    }],
    onCancel: () => {
      // Automatically select the patient for invoice generation
      selectPatientForInvoice(index);
    }
  });
}

// Function to open edit patient modal
function openEditPatientModal(index) {
  const patient = patients[index];
  
  // For debugging
  console.log('Opening edit modal for patient:', patient);
  
  // Create form for editing patient
  const formHTML = `
    <div class="edit-patient-form">
      <div class="form-row">
        <div class="form-group">
          <label for="edit-patient-name">Nombre</label>
          <input type="text" id="edit-patient-name" class="form-control" value="${patient.name}">
        </div>
        <div class="form-group">
          <label for="edit-patient-lastname">Apellido</label>
          <input type="text" id="edit-patient-lastname" class="form-control" value="${patient.lastname}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="edit-patient-birthdate">Fecha de Nacimiento</label>
          <input type="date" id="edit-patient-birthdate" class="form-control" value="${patient.birthdate || ''}">
        </div>
        <div class="form-group">
          <label for="edit-patient-id">Cédula ${calculateAge(patient.birthdate) < 18 ? '<span class="optional-text">(opcional para menores de 18)</span>' : ''}</label>
          <input type="text" id="edit-patient-id" class="form-control" value="${patient.id_number !== '0' ? patient.id_number : ''}" ${calculateAge(patient.birthdate) < 18 ? 'disabled' : ''}>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="edit-patient-email">Correo Electrónico <span class="optional-text">(opcional)</span></label>
          <input type="email" id="edit-patient-email" class="form-control" value="${patient.email !== '0' ? patient.email : ''}">
        </div>
        <div class="form-group">
          <label for="edit-patient-phone">Número de Teléfono <span class="optional-text">(opcional)</span></label>
          <input type="text" id="edit-patient-phone" class="form-control" value="${patient.phone !== '0' ? patient.phone : ''}">
        </div>
      </div>
    </div>
  `;
  
  // Show modal with edit form
  showModal({
    title: 'Editar Paciente',
    content: formHTML,
    confirmText: 'Guardar',
    cancelText: 'Cancelar',
    onConfirm: () => {
      // Save edited patient data
      savePatientEdits(index);
    }
  });
  
  // Add event listener for birthdate changes
  document.getElementById('edit-patient-birthdate').addEventListener('change', function() {
    const birthdateInput = this;
    const idInput = document.getElementById('edit-patient-id');
    
    if (birthdateInput.value) {
      const age = calculateAge(birthdateInput.value);
      
      // Disable cedula field if under 18
      if (age < 18) {
        idInput.disabled = true;
        idInput.placeholder = 'No requerido para menores de edad';
      } else {
        idInput.disabled = false;
        idInput.placeholder = 'Número de cédula';
      }
    }
  });
}

// Function to save patient edits
async function savePatientEdits(index) {
  const patient = patients[index];
  
  // Get values from form
  const name = document.getElementById('edit-patient-name').value;
  const lastname = document.getElementById('edit-patient-lastname').value;
  const birthdate = document.getElementById('edit-patient-birthdate').value;
  const id_number = document.getElementById('edit-patient-id').value || '0';
  const email = document.getElementById('edit-patient-email').value || '0';
  const phone = document.getElementById('edit-patient-phone').value || '0';
  
  // Calculate age from birthdate
  const age = birthdate ? calculateAge(birthdate) : 0;
  
  if (name && lastname && birthdate) {
    // Create updated patient object
    const updatedPatient = {
      ...patient,
      name,
      lastname,
      birthdate,
      age,
      id_number,
      email,
      phone
    };
    
    try {
      // Update patient in Supabase if it has an ID
      if (patient.id) {
        console.log('Updating patient in Supabase:', updatedPatient);
        
        // Prepare data for Supabase (database fields)
        const supabaseUpdates = {
          name,
          lastname,
          age,
          id_number,
          email,
          phone,
          // Convert frontend field names to database field names
          last_visit: patient.last_visit,
          total_spent: patient.total_spent || 0
        };
        
        // Send update to Supabase
        await window.supabaseClient.updatePatient(patient.id, supabaseUpdates);
      }
      
      // Update local array
      patients[index] = updatedPatient;
      saveData();
      updatePatientList();
      updatePatientSelect();
      
      showNotification('success', 'Paciente actualizado', `${name} ${lastname} ha sido actualizado correctamente.`);
    } catch (error) {
      console.error('Error updating patient:', error);
      
      // Update locally anyway
      patients[index] = updatedPatient;
      saveData();
      updatePatientList();
      updatePatientSelect();
      
      showNotification('warning', 'Sincronización pendiente', `${name} ${lastname} ha sido actualizado localmente, pero no se pudo sincronizar con la base de datos.`);
    }
  } else {
    showNotification('error', 'Error', 'Por favor complete al menos el nombre, apellido y fecha de nacimiento del paciente.');
  }
}

// Make functions available globally
// Patient search functionality

function openSearchModal() {
  console.log('openSearchModal called');
  
  // First, remove any existing search modals to prevent duplicates
  const existingModals = document.querySelectorAll('.modal-backdrop');
  existingModals.forEach(modal => {
    modal.remove();
  });
  
  // Create search modal
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  
  const searchModal = document.createElement('div');
  searchModal.className = 'search-modal';
  
  // Set modal content
  searchModal.innerHTML = `
    <div class="search-header">
      <h3><i class="fas fa-search"></i> Buscar Pacientes</h3>
      <div class="search-input-container">
        <i class="fas fa-search"></i>
        <input type="text" id="patient-search-input" class="search-input" placeholder="Buscar por nombre, apellido, cédula...">
      </div>
    </div>
    <div class="search-results" id="search-results"></div>
    <div class="modal-footer">
      <button class="button secondary-button" id="close-search-modal">Cerrar</button>
    </div>
  `;
  
  modalBackdrop.appendChild(searchModal);
  document.body.appendChild(modalBackdrop);
  
  // Show modal
  setTimeout(() => {
    modalBackdrop.classList.add('active');
    // Focus search input
    document.getElementById('patient-search-input').focus();
  }, 10);
  
  // Close button event
  document.getElementById('close-search-modal').addEventListener('click', () => {
    closeSearchModal(modalBackdrop);
  });
  
  // Close on backdrop click (outside the modal)
  modalBackdrop.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) {
      closeSearchModal(modalBackdrop);
    }
  });
  
  // Search input event
  document.getElementById('patient-search-input').addEventListener('input', performSearch);
}

// Dedicated function to close search modal
function closeSearchModal(modalBackdrop) {
  modalBackdrop.classList.remove('active');
  setTimeout(() => {
    modalBackdrop.remove();
  }, 300);
}

function performSearch() {
  const searchInput = document.getElementById('patient-search-input');
  const searchTerm = searchInput.value.toLowerCase().trim();
  const searchResults = document.getElementById('search-results');
  
  // Clear previous results
  searchResults.innerHTML = '';
  
  if (searchTerm.length < 2) {
    searchResults.innerHTML = '<div class="text-center mt-2">Ingrese al menos 2 caracteres para buscar</div>';
    return;
  }
  
  // Filter patients
  const filteredPatients = patients.filter(patient => {
    return patient.name.toLowerCase().includes(searchTerm) ||
           patient.lastname.toLowerCase().includes(searchTerm) ||
           patient.id_number.toLowerCase().includes(searchTerm) ||
           patient.email.toLowerCase().includes(searchTerm) ||
           patient.phone.toLowerCase().includes(searchTerm) ||
           patient.code.toLowerCase().includes(searchTerm);
  });
  
  if (filteredPatients.length === 0) {
    searchResults.innerHTML = '<div class="text-center mt-2">No se encontraron pacientes</div>';
    return;
  }
  
  // Create and display results
  filteredPatients.forEach((patient, index) => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    resultItem.innerHTML = `
      <div class="search-result-name">${highlightText(patient.name + ' ' + patient.lastname, searchTerm)}</div>
      <div class="search-result-details">
        <span><strong>Código:</strong> ${highlightText(patient.code, searchTerm)}</span> | 
        <span><strong>Cédula:</strong> ${highlightText(patient.id_number, searchTerm)}</span>
      </div>
      <div class="search-result-details">
        <span><strong>Email:</strong> ${highlightText(patient.email, searchTerm)}</span> | 
        <span><strong>Teléfono:</strong> ${highlightText(patient.phone, searchTerm)}</span>
      </div>
    `;
    
    // Click event to view patient details
    resultItem.addEventListener('click', () => {
      // First close the search modal
      const modalBackdrop = resultItem.closest('.modal-backdrop');
      closeSearchModal(modalBackdrop);
      
      // Then show patient details
      const patientIndex = patients.findIndex(p => p.id === patient.id);
      viewPatientDetails(patientIndex >= 0 ? patientIndex : index);
    });
    
    searchResults.appendChild(resultItem);
  });
}

function highlightText(text, searchTerm) {
  if (!text) return '';
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.toString().replace(regex, '<span class="highlight">$1</span>');
}

function selectPatientForInvoice(patientIndex) {
  // Get the patient select dropdown in the invoice section
  const patientSelect = document.getElementById('selected-patient');
  
  if (patientSelect && patientIndex >= 0 && patientIndex < patients.length) {
    // Set the selected patient in the dropdown
    patientSelect.value = patientIndex;
    
    // Scroll to the invoice generation section
    const invoiceSection = patientSelect.closest('.card');
    if (invoiceSection) {
      invoiceSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      
      // Add a highlight effect to draw attention
      invoiceSection.style.boxShadow = '0 0 20px rgba(156, 39, 176, 0.5)';
      setTimeout(() => {
        invoiceSection.style.boxShadow = '';
      }, 2000);
    }
    
    // Show success notification
    const patient = patients[patientIndex];
    showNotification('success', 'Paciente seleccionado', `${patient.name} ${patient.lastname} ha sido seleccionado para generar el presupuesto.`);
  }
}

window.deletePatient = deletePatient;
window.deleteService = deleteService;
window.downloadPDF = downloadPDF;
window.sendInvoiceByEmail = sendInvoiceByEmail;
window.viewPatientDetails = viewPatientDetails;
window.openSearchModal = openSearchModal;