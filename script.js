(function() {
// Supabase Configuration
const SUPABASE_URL = 'https://eiwzomuxlwzbmwjtamgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpd3pvbXV4bHd6Ym13anRhbWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzY5MjcsImV4cCI6MjA4ODQxMjkyN30.USKfguETFPNacznHPV4arGwTv_fm669BA_0l1DAFj-Y';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let clients = [];
let projects = [];
let transactions = [];
let subscriptions = [];
let fixedCosts = [];
let deleteCallback = null;
let currentSection = 'dashboard';
let proposalItems = [];
let proposals = [];
let uptimeResults = {};
let notifications = [];
let notificationsOpen = false;
let uptimeInterval = null;
let serviceOptions = [];
let ideas = [];
let currentIdeaFilter = 'all';

// Initialize
async function init() {
  lucide.createIcons();
  await checkAuth();
}

// Auth
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showApp();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  
  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Entrando...';
  lucide.createIcons();
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    errorEl.textContent = 'Email ou senha incorretos.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Entrar';
    lucide.createIcons();
    return;
  }
  
  showApp();
}

async function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await initDatabase();
  await loadAllData();
  loadProposals();
  loadServiceOptions();
  loadNotifications();
  loadIdeas();
  showSection('dashboard');
  // Initial uptime check + auto-refresh every 30min
  checkAllUptimeSilent();
  if (uptimeInterval) clearInterval(uptimeInterval);
  uptimeInterval = setInterval(checkAllUptimeSilent, 30 * 60 * 1000);
}

async function logout() {
  await supabase.auth.signOut();
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) form.addEventListener('submit', handleLogin);
});

// Sidebar Toggle
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('sidebar-open');
  overlay.classList.toggle('hidden');
}

function closeSidebarOnMobile() {
  if (window.innerWidth < 1024) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('sidebar-open');
    if (!overlay.classList.contains('hidden')) overlay.classList.add('hidden');
  }
}

// Database Initialization
async function initDatabase() {
  // Test connection
  try {
    const { data, error } = await supabase.from('clients').select('count').limit(1);
    if (!error) {
      console.log('Database connected successfully');
    }
  } catch (e) {
    console.log('Database test:', e.message);
  }
}

// Data Loading
async function loadAllData() {
  await Promise.all([
    loadClients(),
    loadProjects(),
    loadTransactions(),
    loadSubscriptions(),
    loadFixedCosts()
  ]);
  updateDashboard();
}

async function loadClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!error && data) {
    clients = data;
    renderClients();
    updateClientSelects();
  }
}

async function loadProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!error && data) {
    projects = data;
    renderProjects();
    updateProjectSelects();
  }
}

async function loadTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  
  if (!error && data) {
    transactions = data;
    renderTransactions();
  }
}

async function loadSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!error && data) {
    subscriptions = data;
    renderSubscriptions();
  }
}

async function loadFixedCosts() {
  const { data, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!error && data) {
    fixedCosts = data;
    renderFixedCosts();
  }
}

// Navigation
function showSection(section) {
  currentSection = section;
  closeSidebarOnMobile();
  
  // Hide all sections
  document.querySelectorAll('[id^="section-"]').forEach(el => {
    el.classList.add('hidden');
  });
  
  // Show selected section
  document.getElementById(`section-${section}`).classList.remove('hidden');
  
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-accent-primary/20', 'text-accent-primary');
    if (btn.dataset.section === section) {
      btn.classList.add('bg-accent-primary/20', 'text-accent-primary');
    }
  });
  
  // Update header
  const titles = {
    dashboard: ['Dashboard', 'Visão geral do seu negócio'],
    clients: ['Clientes', 'Gerencie seus clientes'],
    projects: ['Projetos', 'Sites e sistemas'],
    finances: ['Finanças', 'Entradas e saídas'],
    subscriptions: ['Mensalidades', 'Receitas recorrentes'],
    costs: ['Custos Fixos', 'Despesas recorrentes'],
    reports: ['Relatórios', 'Análises detalhadas'],
    kanban: ['Kanban', 'Quadro visual de projetos'],
    insights: ['Insights', 'Análises inteligentes'],
    uptime: ['Uptime', 'Monitor de disponibilidade'],
    proposals: ['Propostas', 'Orçamentos profissionais'],
    ideas: ['Ideias', 'Pipeline de oportunidades futuras']
  };
  
  document.getElementById('pageTitle').textContent = titles[section][0];
  document.getElementById('pageSubtitle').textContent = titles[section][1];
  
  if (section === 'dashboard') {
    updateDashboard();
  }
  if (section === 'reports') {
    generateReport();
  }
  if (section === 'kanban') {
    renderKanban();
  }
  if (section === 'insights') {
    renderInsights();
  }
  if (section === 'uptime') {
    renderUptimeMonitor();
  }
  if (section === 'proposals') {
    renderProposals();
  }
  if (section === 'ideas') {
    renderIdeas();
  }
}

// Dashboard
function updateDashboard() {
  // Calculate stats
  const activeClients = clients.filter(c => c.status !== 'inactive').length;
  const activeProjects = projects.filter(p => ['development', 'active', 'maintenance'].includes(p.status)).length;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date) >= startOfMonth)
    .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
  
  const monthlyExpense = transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth)
    .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
  
  const monthlyCostsTotal = fixedCosts.reduce((sum, c) => {
    const val = parseFloat(c.value || 0);
    if (c.frequency === 'monthly') return sum + val;
    if (c.frequency === 'quarterly') return sum + (val / 3);
    if (c.frequency === 'yearly') return sum + (val / 12);
    return sum;
  }, 0);
  
  const monthlySubscriptions = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
  
  const totalRevenue = monthlyIncome + monthlySubscriptions;
  const totalExpenses = monthlyExpense + monthlyCostsTotal;
  const profit = totalRevenue - totalExpenses;
  
  // Update stats
  document.getElementById('statRevenue').textContent = formatCurrency(totalRevenue);
  document.getElementById('statClients').textContent = activeClients;
  document.getElementById('statProjects').textContent = activeProjects;
  document.getElementById('statProfit').textContent = formatCurrency(profit);
  
  // Revenue by Project
  updateRevenueByProject();
  
  // Recent Transactions
  updateRecentTransactions();
  
  // Pending Payments
  updatePendingPayments();
  
  // Cash Flow Chart
  updateCashFlowChart();
}

function updateRevenueByProject() {
  const container = document.getElementById('revenueByProject');
  
  if (projects.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum projeto cadastrado</p>';
    return;
  }
  
  const projectRevenue = projects.map(project => {
    const income = transactions
      .filter(t => t.type === 'income' && t.project_id === project.id)
      .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    
    const subIncome = subscriptions
      .filter(s => s.project_id === project.id && s.status === 'active')
      .reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
    
    return {
      name: project.name,
      revenue: income + subIncome
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  
  const maxRevenue = Math.max(...projectRevenue.map(p => p.revenue), 1);
  
  container.innerHTML = projectRevenue.map(p => `
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm truncate">${p.name}</span>
        <span class="text-sm font-medium">${formatCurrency(p.revenue)}</span>
      </div>
      <div class="h-2 bg-dark-700 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all" style="width: ${(p.revenue / maxRevenue * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

function updateRecentTransactions() {
  const container = document.getElementById('recentTransactions');
  const recent = transactions.slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma transação registrada</p>';
    return;
  }
  
  container.innerHTML = recent.map(t => {
    const project = projects.find(p => p.id === t.project_id);
    const isIncome = t.type === 'income';
    
    return `
      <div class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg ${isIncome ? 'bg-accent-success/20' : 'bg-accent-danger/20'} flex items-center justify-center">
            <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-5 h-5 ${isIncome ? 'text-accent-success' : 'text-accent-danger'}"></i>
          </div>
          <div>
            <p class="font-medium text-sm">${t.description}</p>
            <p class="text-xs text-gray-500">${project?.name || 'Geral'} • ${formatDate(t.date)}</p>
          </div>
        </div>
        <span class="${isIncome ? 'text-accent-success' : 'text-accent-danger'} font-medium">
          ${isIncome ? '+' : '-'}${formatCurrency(t.value)}
        </span>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function updatePendingPayments() {
  const container = document.getElementById('pendingPayments');
  const pending = subscriptions.filter(s => ['pending', 'overdue'].includes(s.status));
  
  document.getElementById('pendingCount').textContent = `${pending.length} pendentes`;
  
  if (pending.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum pagamento pendente</p>';
    return;
  }
  
  container.innerHTML = pending.map(s => {
    const client = clients.find(c => c.id === s.client_id);
    const project = projects.find(p => p.id === s.project_id);
    const isOverdue = s.status === 'overdue';
    
    return `
      <div class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg ${isOverdue ? 'bg-accent-danger/20' : 'bg-accent-warning/20'} flex items-center justify-center">
            <i data-lucide="clock" class="w-5 h-5 ${isOverdue ? 'text-accent-danger' : 'text-accent-warning'}"></i>
          </div>
          <div>
            <p class="font-medium text-sm">${client?.name || 'Cliente'}</p>
            <p class="text-xs text-gray-500">${project?.name || 'Projeto'} • Dia ${s.due_day}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-medium">${formatCurrency(s.value)}</span>
          <span class="block text-xs ${isOverdue ? 'text-accent-danger' : 'text-accent-warning'}">${isOverdue ? 'Atrasado' : 'Pendente'}</span>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function updateCashFlowChart() {
  const canvas = document.getElementById('cashFlowCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('cashFlowChart');
  
  // Set canvas size
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  const days = parseInt(document.getElementById('chartPeriod').value);
  const now = new Date();
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  
  // Generate data points
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    labels.push(formatDateShort(dateStr));
    
    const dayIncome = transactions
      .filter(t => t.type === 'income' && t.date === dateStr)
      .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    
    const dayExpense = transactions
      .filter(t => t.type === 'expense' && t.date === dateStr)
      .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    
    incomeData.push(dayIncome);
    expenseData.push(dayExpense);
  }
  
  // Draw chart
  drawLineChart(ctx, canvas.width, canvas.height, labels, incomeData, expenseData);
}

function drawLineChart(ctx, width, height, labels, data1, data2) {
  const isSmall = width < 400;
  const padding = { top: 20, right: isSmall ? 10 : 20, bottom: 40, left: isSmall ? 40 : 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Find max value
  const maxValue = Math.max(...data1, ...data2, 100);
  
  // Draw grid lines
  ctx.strokeStyle = '#32324a';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = `${isSmall ? '9px' : '11px'} Plus Jakarta Sans`;
    ctx.textAlign = 'right';
    const value = maxValue - (maxValue / 4) * i;
    ctx.fillText(formatCurrencyShort(value), padding.left - 10, y + 4);
  }
  
  // Draw data lines
  const pointCount = labels.length;
  const stepX = chartWidth / (pointCount - 1 || 1);
  
  // Income line
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data1.forEach((val, i) => {
    const x = padding.left + stepX * i;
    const y = padding.top + chartHeight - (val / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Expense line
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data2.forEach((val, i) => {
    const x = padding.left + stepX * i;
    const y = padding.top + chartHeight - (val / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // X-axis labels (show only some)
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px Plus Jakarta Sans';
  ctx.textAlign = 'center';
  const labelStep = Math.ceil(pointCount / 7);
  labels.forEach((label, i) => {
    if (i % labelStep === 0 || i === pointCount - 1) {
      const x = padding.left + stepX * i;
      ctx.fillText(label, x, height - 10);
    }
  });
  
  // Legend
  const legendFontSize = isSmall ? '9px' : '11px';
  const legendY = isSmall ? 8 : 10;
  const rectSize = isSmall ? 8 : 12;
  
  ctx.fillStyle = '#10b981';
  ctx.fillRect(width - (isSmall ? 110 : 150), legendY, rectSize, rectSize);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = `${legendFontSize} Plus Jakarta Sans`;
  ctx.textAlign = 'left';
  ctx.fillText('Entradas', width - (isSmall ? 98 : 132), legendY + rectSize - 2);
  
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(width - (isSmall ? 48 : 70), legendY, rectSize, rectSize);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText('Saídas', width - (isSmall ? 36 : 52), legendY + rectSize - 2);
}

function drawDonutChart(canvasId, wrapperId, dataItems, colorPalette) {
  const canvas = document.getElementById(canvasId);
  const container = document.getElementById(wrapperId);
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (dataItems.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', width / 2, height / 2);
    return;
  }

  const total = dataItems.reduce((s, d) => s + d.value, 0);
  const cx = Math.min(width * 0.35, height * 0.45);
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 10;
  const innerRadius = radius * 0.55;
  let startAngle = -Math.PI / 2;

  dataItems.forEach((item, i) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colorPalette[i % colorPalette.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center total
  ctx.fillStyle = '#e5e7eb';
  ctx.font = `bold ${radius > 50 ? '14px' : '11px'} Plus Jakarta Sans`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrencyShort(total), cx, cy);

  // Legend on the right
  const legendX = cx + radius + 20;
  const maxLegendItems = Math.min(dataItems.length, Math.floor((height - 20) / 22));
  const legendFontSize = width < 400 ? '10px' : '12px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  dataItems.slice(0, maxLegendItems).forEach((item, i) => {
    const ly = 10 + i * 22;
    ctx.fillStyle = colorPalette[i % colorPalette.length];
    ctx.fillRect(legendX, ly, 10, 10);
    ctx.fillStyle = '#d1d5db';
    ctx.font = `${legendFontSize} Plus Jakarta Sans`;
    const label = item.label.length > 12 ? item.label.substring(0, 11) + '…' : item.label;
    ctx.fillText(`${label}  ${formatCurrencyShort(item.value)}`, legendX + 14, ly);
  });
  if (dataItems.length > maxLegendItems) {
    const ly = 10 + maxLegendItems * 22;
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${legendFontSize} Plus Jakarta Sans`;
    ctx.fillText(`+${dataItems.length - maxLegendItems} mais...`, legendX + 14, ly);
  }
}

function drawBarChart(canvasId, wrapperId, labels, incomeData, expenseData) {
  const canvas = document.getElementById(canvasId);
  const container = document.getElementById(wrapperId);
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (labels.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', width / 2, height / 2);
    return;
  }

  const isSmall = width < 400;
  const padding = { top: 25, right: isSmall ? 10 : 20, bottom: 40, left: isSmall ? 45 : 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...incomeData, ...expenseData, 100);
  const barGroupWidth = chartW / labels.length;
  const barWidth = Math.max(4, Math.min(20, barGroupWidth * 0.3));
  const gap = 3;

  // Grid lines
  ctx.strokeStyle = '#32324a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.font = `${isSmall ? '9px' : '11px'} Plus Jakarta Sans`;
    ctx.textAlign = 'right';
    const val = maxVal - (maxVal / 4) * i;
    ctx.fillText(formatCurrencyShort(val), padding.left - 8, y + 4);
  }

  // Bars
  labels.forEach((label, i) => {
    const centerX = padding.left + barGroupWidth * i + barGroupWidth / 2;
    const incH = (incomeData[i] / maxVal) * chartH;
    const expH = (expenseData[i] / maxVal) * chartH;

    // Income bar
    ctx.fillStyle = '#10b981';
    ctx.fillRect(centerX - barWidth - gap / 2, padding.top + chartH - incH, barWidth, incH);

    // Expense bar
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(centerX + gap / 2, padding.top + chartH - expH, barWidth, expH);

    // X label
    ctx.fillStyle = '#6b7280';
    ctx.font = `${isSmall ? '8px' : '10px'} Plus Jakarta Sans`;
    ctx.textAlign = 'center';
    ctx.fillText(label, centerX, height - (isSmall ? 5 : 10));
  });

  // Legend
  const legendFont = isSmall ? '9px' : '11px';
  ctx.fillStyle = '#10b981';
  ctx.fillRect(width - (isSmall ? 110 : 150), 8, 10, 10);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = `${legendFont} Plus Jakarta Sans`;
  ctx.textAlign = 'left';
  ctx.fillText('Receitas', width - (isSmall ? 96 : 134), 17);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(width - (isSmall ? 48 : 70), 8, 10, 10);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText('Despesas', width - (isSmall ? 34 : 54), 17);
}

function updateChartPeriod() {
  updateCashFlowChart();
}

// Render Functions
function renderClients() {
  const container = document.getElementById('clientsTable');
  const cardsContainer = document.getElementById('clientsCards');
  
  if (clients.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhum cliente cadastrado</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<p class="text-center py-6 text-gray-500 text-sm">Nenhum cliente cadastrado</p>';
    return;
  }
  
  container.innerHTML = clients.map(client => {
    const clientProjects = projects.filter(p => p.client_id === client.id);
    
    return `
      <tr class="border-t border-dark-600 hover:bg-dark-700/50 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center font-bold">
              ${client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="font-medium">${client.name}</p>
              <p class="text-xs text-gray-500">${client.company || '-'}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-400">${client.email || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-400">${client.phone || '-'}</td>
        <td class="px-6 py-4 text-sm">${clientProjects.length}</td>
        <td class="px-6 py-4">
          <span class="px-2 py-1 rounded-full text-xs ${client.status === 'active' ? 'bg-accent-success/20 text-accent-success' : 'bg-gray-500/20 text-gray-500'}">
            ${client.status === 'active' ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="editClient('${client.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteClient('${client.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors text-accent-danger">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Mobile cards
  if (cardsContainer) {
    cardsContainer.innerHTML = clients.map(client => {
      const clientProjects = projects.filter(p => p.client_id === client.id);
      return `
        <div class="glass rounded-xl p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center font-bold text-sm flex-shrink-0">
                ${client.name.charAt(0).toUpperCase()}
              </div>
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">${client.name}</p>
                <p class="text-xs text-gray-500 truncate">${client.email || client.phone || '-'}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <span class="px-1.5 py-0.5 rounded-full text-xs ${client.status === 'active' ? 'bg-accent-success/20 text-accent-success' : 'bg-gray-500/20 text-gray-500'}">
                ${clientProjects.length}p
              </span>
              <button onclick="editClient('${client.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteClient('${client.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg text-accent-danger">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

function renderProjects() {
  const container = document.getElementById('projectsGrid');
  
  if (projects.length === 0) {
    container.innerHTML = '<div class="glass rounded-xl p-8 text-center text-gray-500 col-span-full">Nenhum projeto cadastrado</div>';
    return;
  }
  
  const statusColors = {
    proposal: 'bg-gray-500',
    development: 'bg-accent-warning',
    review: 'bg-accent-secondary',
    active: 'bg-accent-success',
    maintenance: 'bg-accent-primary',
    paused: 'bg-gray-500',
    cancelled: 'bg-accent-danger'
  };
  
  const statusLabels = {
    proposal: 'Proposta',
    development: 'Em Desenvolvimento',
    review: 'Em Revisão',
    active: 'Ativo',
    maintenance: 'Manutenção',
    paused: 'Pausado',
    cancelled: 'Cancelado'
  };
  
  const typeIcons = {
    website: 'globe',
    system: 'server',
    ecommerce: 'shopping-cart',
    app: 'smartphone',
    landing: 'layout',
    other: 'folder'
  };
  
  container.innerHTML = projects.map(project => {
    const client = clients.find(c => c.id === project.client_id);
    
    return `
      <div class="glass rounded-xl p-5 hover:border-accent-primary/30 transition-all cursor-pointer" onclick="editProject('${project.id}')">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-accent-primary/20 flex items-center justify-center">
            <i data-lucide="${typeIcons[project.type] || 'folder'}" class="w-6 h-6 text-accent-primary"></i>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${statusColors[project.status]}"></span>
            <span class="text-xs text-gray-400">${statusLabels[project.status]}</span>
          </div>
        </div>
        <h4 class="font-semibold mb-1 truncate">${project.name}</h4>
        <p class="text-sm text-gray-500 mb-1">${client?.name || 'Sem cliente'}</p>
        <div class="flex items-center gap-1.5 mb-2" id="uptime-badge-${project.id}"></div>
        ${project.value ? `<p class="text-lg font-bold text-accent-primary">${formatCurrency(project.value)}</p>` : ''}
        ${project.url ? `
          <a href="${project.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 text-xs text-accent-primary hover:underline mt-2">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            Ver site
          </a>
        ` : ''}
        <div class="flex gap-2 mt-3 pt-3 border-t border-dark-600">
          <button onclick="event.stopPropagation(); openSchema('${project.id}')" class="flex items-center gap-1.5 text-xs bg-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/30 px-2.5 py-1.5 rounded-lg transition-colors">
            <i data-lucide="git-branch" class="w-3.5 h-3.5"></i> Schema
          </button>
          <button onclick="event.stopPropagation(); openChangelog('${project.id}')" class="flex items-center gap-1.5 text-xs bg-accent-warning/20 text-accent-warning hover:bg-accent-warning/30 px-2.5 py-1.5 rounded-lg transition-colors">
            <i data-lucide="history" class="w-3.5 h-3.5"></i> Log
          </button>
          <button onclick="event.stopPropagation(); deleteProject('${project.id}')" class="flex items-center gap-1.5 text-xs bg-dark-700 text-gray-400 hover:bg-accent-danger/20 hover:text-accent-danger px-2.5 py-1.5 rounded-lg transition-colors ml-auto">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function renderTransactions() {
  const container = document.getElementById('transactionsTable');
  const cardsContainer = document.getElementById('transactionsCards');
  
  const filterType = document.getElementById('filterType')?.value || 'all';
  const filterProject = document.getElementById('filterProject')?.value || 'all';
  const filterMonth = document.getElementById('filterMonth')?.value || '';
  
  let filtered = [...transactions];
  
  if (filterType !== 'all') {
    filtered = filtered.filter(t => t.type === filterType);
  }
  
  if (filterProject !== 'all') {
    filtered = filtered.filter(t => t.project_id === filterProject);
  }
  
  if (filterMonth) {
    filtered = filtered.filter(t => t.date && t.date.startsWith(filterMonth));
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhuma transação encontrada</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<p class="text-center py-6 text-gray-500 text-sm">Nenhuma transação encontrada</p>';
    updateFinanceSummary();
    return;
  }
  
  container.innerHTML = filtered.map(t => {
    const project = projects.find(p => p.id === t.project_id);
    const isIncome = t.type === 'income';
    
    return `
      <tr class="border-t border-dark-600 hover:bg-dark-700/50 transition-colors">
        <td class="px-6 py-4 text-sm">${formatDate(t.date)}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg ${isIncome ? 'bg-accent-success/20' : 'bg-accent-danger/20'} flex items-center justify-center">
              <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${isIncome ? 'text-accent-success' : 'text-accent-danger'}"></i>
            </div>
            <span class="font-medium">${t.description}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-400">${project?.name || 'Geral'}</td>
        <td class="px-6 py-4 text-sm text-gray-400">${getCategoryLabel(t.category)}</td>
        <td class="px-6 py-4 font-medium ${isIncome ? 'text-accent-success' : 'text-accent-danger'}">
          ${isIncome ? '+' : '-'}${formatCurrency(t.value)}
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="editTransaction('${t.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteTransaction('${t.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors text-accent-danger">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Mobile cards
  if (cardsContainer) {
    cardsContainer.innerHTML = filtered.map(t => {
      const project = projects.find(p => p.id === t.project_id);
      const isIncome = t.type === 'income';
      return `
        <div class="glass rounded-xl p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg ${isIncome ? 'bg-accent-success/20' : 'bg-accent-danger/20'} flex items-center justify-center flex-shrink-0">
                <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${isIncome ? 'text-accent-success' : 'text-accent-danger'}"></i>
              </div>
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">${t.description}</p>
                <p class="text-xs text-gray-500">${formatDate(t.date)} · ${project?.name || 'Geral'}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <span class="text-sm font-semibold ${isIncome ? 'text-accent-success' : 'text-accent-danger'} whitespace-nowrap">${isIncome ? '+' : '-'}${formatCurrency(t.value)}</span>
              <button onclick="editTransaction('${t.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteTransaction('${t.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg text-accent-danger">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
  updateFinanceSummary();
}

function updateFinanceSummary() {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
  
  const balance = totalIncome - totalExpense;
  
  document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
  document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
  document.getElementById('totalBalance').textContent = formatCurrency(balance);
  document.getElementById('totalBalance').className = `text-sm sm:text-2xl font-bold truncate ${balance >= 0 ? 'text-accent-success' : 'text-accent-danger'}`;
}

function filterTransactions() {
  renderTransactions();
}

function renderSubscriptions() {
  const container = document.getElementById('subscriptionsTable');
  const cardsContainer = document.getElementById('subscriptionsCards');
  
  if (subscriptions.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhuma mensalidade cadastrada</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<p class="text-center py-6 text-gray-500 text-sm">Nenhuma mensalidade cadastrada</p>';
    updateSubscriptionStats();
    return;
  }
  
  const statusColors = {
    active: 'bg-accent-success/20 text-accent-success',
    pending: 'bg-accent-warning/20 text-accent-warning',
    overdue: 'bg-accent-danger/20 text-accent-danger',
    cancelled: 'bg-gray-500/20 text-gray-500'
  };
  
  const statusLabels = {
    active: 'Ativo',
    pending: 'Pendente',
    overdue: 'Atrasado',
    cancelled: 'Cancelado'
  };
  
  container.innerHTML = subscriptions.map(s => {
    const client = clients.find(c => c.id === s.client_id);
    const project = projects.find(p => p.id === s.project_id);
    
    return `
      <tr class="border-t border-dark-600 hover:bg-dark-700/50 transition-colors">
        <td class="px-6 py-4 font-medium">${client?.name || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-400">${project?.name || '-'}</td>
        <td class="px-6 py-4 font-medium">${formatCurrency(s.value)}</td>
        <td class="px-6 py-4 text-sm">Dia ${s.due_day}</td>
        <td class="px-6 py-4">
          <span class="px-2 py-1 rounded-full text-xs ${statusColors[s.status]}">
            ${statusLabels[s.status]}
          </span>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="editSubscription('${s.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteSubscription('${s.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors text-accent-danger">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Mobile cards
  if (cardsContainer) {
    cardsContainer.innerHTML = subscriptions.map(s => {
      const client = clients.find(c => c.id === s.client_id);
      const project = projects.find(p => p.id === s.project_id);
      return `
        <div class="glass rounded-xl p-3">
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <p class="font-medium text-sm truncate">${client?.name || '-'}</p>
              <p class="text-xs text-gray-500 truncate">${project?.name || '-'} · Dia ${s.due_day}</p>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-sm font-semibold whitespace-nowrap">${formatCurrency(s.value)}</span>
              <span class="px-1.5 py-0.5 rounded-full text-xs ${statusColors[s.status]}">${statusLabels[s.status]}</span>
              <button onclick="editSubscription('${s.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteSubscription('${s.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg text-accent-danger">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
  updateSubscriptionStats();
}

function updateSubscriptionStats() {
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const mrr = activeSubs.reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
  const arr = mrr * 12;
  const avgTicket = activeSubs.length > 0 ? mrr / activeSubs.length : 0;
  
  document.getElementById('mrrValue').textContent = formatCurrency(mrr);
  document.getElementById('arrValue').textContent = formatCurrency(arr);
  document.getElementById('activeSubscriptions').textContent = activeSubs.length;
  document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
}

function renderFixedCosts() {
  const container = document.getElementById('costsTable');
  const cardsContainer = document.getElementById('costsCards');
  
  if (fixedCosts.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhum custo fixo cadastrado</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<p class="text-center py-6 text-gray-500 text-sm">Nenhum custo fixo cadastrado</p>';
    updateCostStats();
    return;
  }
  
  const freqLabels = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual'
  };
  
  container.innerHTML = fixedCosts.map(c => {
    const project = projects.find(p => p.id === c.project_id);
    
    return `
      <tr class="border-t border-dark-600 hover:bg-dark-700/50 transition-colors">
        <td class="px-6 py-4 font-medium">${c.description}</td>
        <td class="px-6 py-4 text-sm text-gray-400">${project?.name || 'Geral'}</td>
        <td class="px-6 py-4 text-sm text-gray-400">${getCategoryLabel(c.category)}</td>
        <td class="px-6 py-4 font-medium text-accent-danger">${formatCurrency(c.value)}</td>
        <td class="px-6 py-4 text-sm">${freqLabels[c.frequency]}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="editCost('${c.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteCost('${c.id}')" class="p-2 hover:bg-dark-600 rounded-lg transition-colors text-accent-danger">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Mobile cards
  if (cardsContainer) {
    cardsContainer.innerHTML = fixedCosts.map(c => {
      const project = projects.find(p => p.id === c.project_id);
      return `
        <div class="glass rounded-xl p-3">
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <p class="font-medium text-sm truncate">${c.description}</p>
              <p class="text-xs text-gray-500 truncate">${project?.name || 'Geral'} · ${freqLabels[c.frequency]}</p>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-sm font-semibold text-accent-danger whitespace-nowrap">${formatCurrency(c.value)}</span>
              <button onclick="editCost('${c.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteCost('${c.id}')" class="p-1.5 hover:bg-dark-600 rounded-lg text-accent-danger">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
  updateCostStats();
}

function updateCostStats() {
  const monthlyCostsTotal = fixedCosts.reduce((sum, c) => {
    const val = parseFloat(c.value || 0);
    if (c.frequency === 'monthly') return sum + val;
    if (c.frequency === 'quarterly') return sum + (val / 3);
    if (c.frequency === 'yearly') return sum + (val / 12);
    return sum;
  }, 0);
  
  const annualCostsTotal = monthlyCostsTotal * 12;
  
  const mrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + parseFloat(s.value || 0), 0);
  
  const margin = mrr > 0 ? ((mrr - monthlyCostsTotal) / mrr * 100) : 0;
  
  document.getElementById('monthlyCosts').textContent = formatCurrency(monthlyCostsTotal);
  document.getElementById('annualCosts').textContent = formatCurrency(annualCostsTotal);
  document.getElementById('profitMargin').textContent = `${margin.toFixed(1)}%`;
}

// Update Selects
function updateClientSelects() {
  const selects = ['projectClient', 'subscriptionClient'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Selecione um cliente</option>' +
        clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      select.value = currentValue;
    }
  });
}

function updateProjectSelects() {
  const selects = ['subscriptionProject', 'transactionProject', 'costProject', 'filterProject'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentValue = select.value;
      const emptyOption = id === 'filterProject' ? '<option value="all">Todos os projetos</option>' : '<option value="">Nenhum (Geral)</option>';
      select.innerHTML = emptyOption +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      select.value = currentValue;
    }
  });
}

// Modal Functions
function openModal(modalId, type) {
  document.getElementById(modalId).classList.remove('hidden');
  
  if (modalId === 'transactionModal' && type) {
    document.getElementById('transactionType').value = type;
    document.getElementById('transactionModalTitle').textContent = type === 'income' ? 'Nova Entrada' : 'Nova Saída';
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
  }
  
  if (modalId === 'clientModal') {
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientModalTitle').textContent = 'Novo Cliente';
  }
  
  if (modalId === 'projectModal') {
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('projectModalTitle').textContent = 'Novo Projeto';
    document.getElementById('projectStartDate').value = new Date().toISOString().split('T')[0];
  }
  
  if (modalId === 'subscriptionModal') {
    document.getElementById('subscriptionForm').reset();
    document.getElementById('subscriptionId').value = '';
    document.getElementById('subscriptionModalTitle').textContent = 'Nova Mensalidade';
  }
  
  if (modalId === 'costModal') {
    document.getElementById('costForm').reset();
    document.getElementById('costId').value = '';
    document.getElementById('costModalTitle').textContent = 'Novo Custo Fixo';
  }
  
  lucide.createIcons();
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// CRUD Operations
async function saveClient(event) {
  event.preventDefault();
  
  const id = document.getElementById('clientId').value;
  const clientData = {
    name: document.getElementById('clientName').value,
    email: document.getElementById('clientEmail').value || null,
    phone: document.getElementById('clientPhone').value || null,
    company: document.getElementById('clientCompany').value || null,
    notes: document.getElementById('clientNotes').value || null,
    status: 'active'
  };
  
  let result;
  if (id) {
    result = await supabase.from('clients').update(clientData).eq('id', id);
  } else {
    result = await supabase.from('clients').insert(clientData);
  }
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
  } else {
    showToast('success', 'Sucesso', id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
    closeModal('clientModal');
    await loadClients();
    updateDashboard();
  }
}

function editClient(id) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  
  document.getElementById('clientId').value = client.id;
  document.getElementById('clientName').value = client.name || '';
  document.getElementById('clientEmail').value = client.email || '';
  document.getElementById('clientPhone').value = client.phone || '';
  document.getElementById('clientCompany').value = client.company || '';
  document.getElementById('clientNotes').value = client.notes || '';
  document.getElementById('clientModalTitle').textContent = 'Editar Cliente';
  
  document.getElementById('clientModal').classList.remove('hidden');
}

function deleteClient(id) {
  document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir este cliente? Projetos associados serão desvinculados.';
  deleteCallback = async () => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro', error.message);
    } else {
      showToast('success', 'Sucesso', 'Cliente excluído!');
      await loadClients();
      updateDashboard();
    }
  };
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function saveProject(event) {
  event.preventDefault();
  
  const id = document.getElementById('projectId').value;
  const projectData = {
    name: document.getElementById('projectName').value,
    client_id: document.getElementById('projectClient').value || null,
    type: document.getElementById('projectType').value,
    value: parseFloat(document.getElementById('projectValue').value) || null,
    status: document.getElementById('projectStatus').value,
    start_date: document.getElementById('projectStartDate').value || null,
    deadline: document.getElementById('projectDeadline').value || null,
    url: document.getElementById('projectUrl').value || null,
    description: document.getElementById('projectDescription').value || null
  };
  
  let result;
  if (id) {
    result = await supabase.from('projects').update(projectData).eq('id', id);
  } else {
    result = await supabase.from('projects').insert(projectData);
  }
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
  } else {
    showToast('success', 'Sucesso', id ? 'Projeto atualizado!' : 'Projeto cadastrado!');
    closeModal('projectModal');
    await loadProjects();
    updateDashboard();
  }
}

function editProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  
  document.getElementById('projectId').value = project.id;
  document.getElementById('projectName').value = project.name || '';
  document.getElementById('projectClient').value = project.client_id || '';
  document.getElementById('projectType').value = project.type || 'website';
  document.getElementById('projectValue').value = project.value || '';
  document.getElementById('projectStatus').value = project.status || 'proposal';
  document.getElementById('projectStartDate').value = project.start_date || '';
  document.getElementById('projectDeadline').value = project.deadline || '';
  document.getElementById('projectUrl').value = project.url || '';
  document.getElementById('projectDescription').value = project.description || '';
  document.getElementById('projectModalTitle').textContent = 'Editar Projeto';
  
  document.getElementById('projectModal').classList.remove('hidden');
}

function deleteProject(id) {
  document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir este projeto?';
  deleteCallback = async () => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro', error.message);
    } else {
      showToast('success', 'Sucesso', 'Projeto excluído!');
      await loadProjects();
      updateDashboard();
    }
  };
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function saveTransaction(event) {
  event.preventDefault();
  
  const id = document.getElementById('transactionId').value;
  const transactionData = {
    type: document.getElementById('transactionType').value,
    description: document.getElementById('transactionDescription').value,
    value: parseFloat(document.getElementById('transactionValue').value),
    date: document.getElementById('transactionDate').value,
    project_id: document.getElementById('transactionProject').value || null,
    category: document.getElementById('transactionCategory').value
  };
  
  let result;
  if (id) {
    result = await supabase.from('transactions').update(transactionData).eq('id', id);
  } else {
    result = await supabase.from('transactions').insert(transactionData);
  }
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
  } else {
    showToast('success', 'Sucesso', id ? 'Transação atualizada!' : 'Transação registrada!');
    closeModal('transactionModal');
    await loadTransactions();
    updateDashboard();
  }
}

function editTransaction(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;
  
  document.getElementById('transactionId').value = transaction.id;
  document.getElementById('transactionType').value = transaction.type;
  document.getElementById('transactionDescription').value = transaction.description || '';
  document.getElementById('transactionValue').value = transaction.value || '';
  document.getElementById('transactionDate').value = transaction.date || '';
  document.getElementById('transactionProject').value = transaction.project_id || '';
  document.getElementById('transactionCategory').value = transaction.category || 'other';
  document.getElementById('transactionModalTitle').textContent = 'Editar Transação';
  
  document.getElementById('transactionModal').classList.remove('hidden');
}

function deleteTransaction(id) {
  document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir esta transação?';
  deleteCallback = async () => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro', error.message);
    } else {
      showToast('success', 'Sucesso', 'Transação excluída!');
      await loadTransactions();
      updateDashboard();
    }
  };
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function saveSubscription(event) {
  event.preventDefault();
  
  const id = document.getElementById('subscriptionId').value;
  const subscriptionData = {
    client_id: document.getElementById('subscriptionClient').value,
    project_id: document.getElementById('subscriptionProject').value,
    value: parseFloat(document.getElementById('subscriptionValue').value),
    due_day: parseInt(document.getElementById('subscriptionDueDay').value),
    status: document.getElementById('subscriptionStatus').value
  };
  
  let result;
  if (id) {
    result = await supabase.from('subscriptions').update(subscriptionData).eq('id', id);
  } else {
    result = await supabase.from('subscriptions').insert(subscriptionData);
  }
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
  } else {
    showToast('success', 'Sucesso', id ? 'Mensalidade atualizada!' : 'Mensalidade cadastrada!');
    closeModal('subscriptionModal');
    await loadSubscriptions();
    updateDashboard();
  }
}

function editSubscription(id) {
  const subscription = subscriptions.find(s => s.id === id);
  if (!subscription) return;
  
  document.getElementById('subscriptionId').value = subscription.id;
  document.getElementById('subscriptionClient').value = subscription.client_id || '';
  document.getElementById('subscriptionProject').value = subscription.project_id || '';
  document.getElementById('subscriptionValue').value = subscription.value || '';
  document.getElementById('subscriptionDueDay').value = subscription.due_day || '';
  document.getElementById('subscriptionStatus').value = subscription.status || 'active';
  document.getElementById('subscriptionModalTitle').textContent = 'Editar Mensalidade';
  
  document.getElementById('subscriptionModal').classList.remove('hidden');
}

function deleteSubscription(id) {
  document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir esta mensalidade?';
  deleteCallback = async () => {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro', error.message);
    } else {
      showToast('success', 'Sucesso', 'Mensalidade excluída!');
      await loadSubscriptions();
      updateDashboard();
    }
  };
  document.getElementById('deleteModal').classList.remove('hidden');
}

async function saveCost(event) {
  event.preventDefault();
  
  const id = document.getElementById('costId').value;
  const costData = {
    description: document.getElementById('costDescription').value,
    project_id: document.getElementById('costProject').value || null,
    value: parseFloat(document.getElementById('costValue').value),
    frequency: document.getElementById('costFrequency').value,
    category: document.getElementById('costCategory').value
  };
  
  let result;
  if (id) {
    result = await supabase.from('fixed_costs').update(costData).eq('id', id);
  } else {
    result = await supabase.from('fixed_costs').insert(costData);
  }
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
  } else {
    showToast('success', 'Sucesso', id ? 'Custo atualizado!' : 'Custo cadastrado!');
    closeModal('costModal');
    await loadFixedCosts();
    updateDashboard();
  }
}

function editCost(id) {
  const cost = fixedCosts.find(c => c.id === id);
  if (!cost) return;
  
  document.getElementById('costId').value = cost.id;
  document.getElementById('costDescription').value = cost.description || '';
  document.getElementById('costProject').value = cost.project_id || '';
  document.getElementById('costValue').value = cost.value || '';
  document.getElementById('costFrequency').value = cost.frequency || 'monthly';
  document.getElementById('costCategory').value = cost.category || 'other';
  document.getElementById('costModalTitle').textContent = 'Editar Custo Fixo';
  
  document.getElementById('costModal').classList.remove('hidden');
}

function deleteCost(id) {
  document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir este custo fixo?';
  deleteCallback = async () => {
    const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro', error.message);
    } else {
      showToast('success', 'Sucesso', 'Custo excluído!');
      await loadFixedCosts();
      updateDashboard();
    }
  };
  document.getElementById('deleteModal').classList.remove('hidden');
}

function confirmDelete() {
  if (deleteCallback) {
    deleteCallback();
    deleteCallback = null;
  }
  closeModal('deleteModal');
}

// Reports
function generateReport() {
  const period = document.getElementById('reportPeriod').value;
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(2020, 0, 1);
  }
  
  // Revenue by Client
  const revenueByClientContainer = document.getElementById('revenueByClient');
  const clientRevenue = clients.map(client => {
    const clientProjects = projects.filter(p => p.client_id === client.id);
    const projectIds = clientProjects.map(p => p.id);
    
    const income = transactions
      .filter(t => t.type === 'income' && projectIds.includes(t.project_id) && new Date(t.date) >= startDate)
      .reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    
    return { name: client.name, revenue: income };
  }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  
  if (clientRevenue.length > 0) {
    const maxRevenue = Math.max(...clientRevenue.map(c => c.revenue));
    revenueByClientContainer.innerHTML = clientRevenue.map(c => `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm">${c.name}</span>
          <span class="text-sm font-medium">${formatCurrency(c.revenue)}</span>
        </div>
        <div class="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div class="h-full bg-accent-success rounded-full" style="width: ${(c.revenue / maxRevenue * 100)}%"></div>
        </div>
      </div>
    `).join('');
  } else {
    revenueByClientContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Sem dados para exibir</p>';
  }
  
  // Expense by Category
  const expenseByCategoryContainer = document.getElementById('expenseByCategory');
  const categoryExpenses = {};
  
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= startDate)
    .forEach(t => {
      const cat = t.category || 'other';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + parseFloat(t.value || 0);
    });
  
  const categoryData = Object.entries(categoryExpenses)
    .map(([cat, value]) => ({ category: cat, value }))
    .sort((a, b) => b.value - a.value);
  
  if (categoryData.length > 0) {
    const maxExpense = Math.max(...categoryData.map(c => c.value));
    expenseByCategoryContainer.innerHTML = categoryData.map(c => `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm">${getCategoryLabel(c.category)}</span>
          <span class="text-sm font-medium">${formatCurrency(c.value)}</span>
        </div>
        <div class="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div class="h-full bg-accent-danger rounded-full" style="width: ${(c.value / maxExpense * 100)}%"></div>
        </div>
      </div>
    `).join('');
  } else {
    expenseByCategoryContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Sem dados para exibir</p>';
  }
  
  // Monthly Evolution
  const monthlyEvolutionContainer = document.getElementById('monthlyEvolution');
  const monthlyData = {};
  
  transactions.forEach(t => {
    if (new Date(t.date) >= startDate) {
      const month = t.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        monthlyData[month].income += parseFloat(t.value || 0);
      } else {
        monthlyData[month].expense += parseFloat(t.value || 0);
      }
    }
  });
  
  const months = Object.keys(monthlyData).sort();
  
  if (months.length > 0) {
    monthlyEvolutionContainer.innerHTML = months.map(month => {
      const data = monthlyData[month];
      const profit = data.income - data.expense;
      const margin = data.income > 0 ? (profit / data.income * 100) : 0;
      
      return `
        <tr class="border-t border-dark-600">
          <td class="py-3">${formatMonthYear(month)}</td>
          <td class="py-3 text-accent-success">${formatCurrency(data.income)}</td>
          <td class="py-3 text-accent-danger">${formatCurrency(data.expense)}</td>
          <td class="py-3 ${profit >= 0 ? 'text-accent-success' : 'text-accent-danger'}">${formatCurrency(profit)}</td>
          <td class="py-3">${margin.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  } else {
    monthlyEvolutionContainer.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Sem dados para exibir</td></tr>';
  }

  // Draw canvas charts
  const successColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#047857', '#065f46'];
  const dangerColors = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#dc2626', '#b91c1c', '#991b1b'];

  drawDonutChart(
    'revenueByClientCanvas',
    'revenueByClientChartWrap',
    clientRevenue.map(c => ({ label: c.name, value: c.revenue })),
    successColors
  );

  drawDonutChart(
    'expenseByCategoryCanvas',
    'expenseByCategoryChartWrap',
    categoryData.map(c => ({ label: getCategoryLabel(c.category), value: c.value })),
    dangerColors
  );

  const monthLabels = months.map(m => formatMonthYear(m));
  const monthIncome = months.map(m => monthlyData[m].income);
  const monthExpense = months.map(m => monthlyData[m].expense);
  drawBarChart('monthlyEvolutionCanvas', 'monthlyEvolutionChartWrap', monthLabels, monthIncome, monthExpense);
}

function exportReport() {
  const period = document.getElementById('reportPeriod').value;
  const periodLabels = {
    month: 'Este Mês',
    quarter: 'Este Trimestre',
    year: 'Este Ano',
    all: 'Todo Período'
  };
  
  // Create CSV content
  let csv = 'Relatório Financeiro - ' + periodLabels[period] + '\n\n';
  csv += 'Tipo,Descrição,Projeto,Data,Valor\n';
  
  transactions.forEach(t => {
    const project = projects.find(p => p.id === t.project_id);
    csv += `${t.type === 'income' ? 'Entrada' : 'Saída'},"${t.description}","${project?.name || 'Geral'}",${t.date},${t.value}\n`;
  });
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  showToast('success', 'Exportado', 'Relatório baixado com sucesso!');
}

// Utility Functions
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

function formatCurrencyShort(value) {
  if (value >= 1000) {
    return 'R$ ' + (value / 1000).toFixed(1) + 'k';
  }
  return 'R$ ' + value.toFixed(0);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMonthYear(monthStr) {
  const [year, month] = monthStr.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year}`;
}

function getCategoryLabel(category) {
  const labels = {
    project: 'Projeto',
    subscription: 'Mensalidade',
    hosting: 'Hospedagem',
    domain: 'Domínio',
    ssl: 'SSL/Certificado',
    tools: 'Ferramentas',
    api: 'API/Serviços',
    marketing: 'Marketing',
    other: 'Outro'
  };
  return labels[category] || category;
}

function updateLastSync() {
  const now = new Date();
  document.getElementById('lastSync').textContent = `Última sync: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function showToast(type, title, message) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const messageEl = document.getElementById('toastMessage');
  
  const icons = {
    success: { icon: 'check', class: 'bg-accent-success/20 text-accent-success' },
    error: { icon: 'x', class: 'bg-accent-danger/20 text-accent-danger' },
    info: { icon: 'info', class: 'bg-accent-primary/20 text-accent-primary' }
  };
  
  const config = icons[type] || icons.info;
  
  icon.className = `w-8 h-8 rounded-lg flex items-center justify-center ${config.class}`;
  icon.innerHTML = `<i data-lucide="${config.icon}" class="w-4 h-4"></i>`;
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  toast.classList.remove('hidden');
  lucide.createIcons();
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ========== Schema Functions ==========

function openSchema(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  document.getElementById('schemaProjectId').value = projectId;
  document.getElementById('schemaModalTitle').textContent = `Schema — ${project.name}`;
  
  const schema = project.schema || {};
  populateSchemaForm(schema);
  renderSchemaView(project, schema);
  
  // Start in view mode
  document.getElementById('schemaView').classList.remove('hidden');
  document.getElementById('schemaEdit').classList.add('hidden');
  document.getElementById('schemaEditToggle').innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i> <span class="hidden sm:inline">Editar</span>';
  
  document.getElementById('schemaModal').classList.remove('hidden');
  lucide.createIcons();
}

function toggleSchemaEdit() {
  const view = document.getElementById('schemaView');
  const edit = document.getElementById('schemaEdit');
  const btn = document.getElementById('schemaEditToggle');
  const isEditing = !edit.classList.contains('hidden');
  
  if (isEditing) {
    view.classList.remove('hidden');
    edit.classList.add('hidden');
    btn.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i> <span class="hidden sm:inline">Editar</span>';
  } else {
    view.classList.add('hidden');
    edit.classList.remove('hidden');
    btn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i> <span class="hidden sm:inline">Visualizar</span>';
  }
  lucide.createIcons();
}

function populateSchemaForm(schema) {
  document.getElementById('schemaDomain').value = schema.domain || '';
  document.getElementById('schemaHosting').value = schema.hosting || '';
  document.getElementById('schemaDatabase').value = schema.database || '';
  document.getElementById('schemaSsl').value = schema.ssl || '';
  document.getElementById('schemaFrontend').value = schema.frontend || '';
  document.getElementById('schemaBackend').value = schema.backend || '';
  document.getElementById('schemaOtherTech').value = schema.other_tech || '';
  document.getElementById('schemaChargeType').value = schema.charge_type || '';
  document.getElementById('schemaTotalValue').value = schema.total_value || '';
  document.getElementById('schemaMonthlyFee').value = schema.monthly_fee || '';
  document.getElementById('schemaDueDay').value = schema.due_day || '';
  document.getElementById('schemaCostHosting').value = schema.cost_hosting || '';
  document.getElementById('schemaCostDomain').value = schema.cost_domain || '';
  document.getElementById('schemaCostTools').value = schema.cost_tools || '';
  document.getElementById('schemaCostOther').value = schema.cost_other || '';
  document.getElementById('schemaDeliveryDate').value = schema.delivery_date || '';
  document.getElementById('schemaLastUpdate').value = schema.last_update || '';
  document.getElementById('schemaLastMaintenance').value = schema.last_maintenance || '';
  document.getElementById('schemaNextMaintenance').value = schema.next_maintenance || '';
  document.getElementById('schemaDomainRenewal').value = schema.domain_renewal || '';
  document.getElementById('schemaHostingRenewal').value = schema.hosting_renewal || '';
  document.getElementById('schemaNotes').value = schema.notes || '';
}

function getSchemaFormData() {
  return {
    domain: document.getElementById('schemaDomain').value || null,
    hosting: document.getElementById('schemaHosting').value || null,
    database: document.getElementById('schemaDatabase').value || null,
    ssl: document.getElementById('schemaSsl').value || null,
    frontend: document.getElementById('schemaFrontend').value || null,
    backend: document.getElementById('schemaBackend').value || null,
    other_tech: document.getElementById('schemaOtherTech').value || null,
    charge_type: document.getElementById('schemaChargeType').value || null,
    total_value: parseFloat(document.getElementById('schemaTotalValue').value) || null,
    monthly_fee: parseFloat(document.getElementById('schemaMonthlyFee').value) || null,
    due_day: parseInt(document.getElementById('schemaDueDay').value) || null,
    cost_hosting: parseFloat(document.getElementById('schemaCostHosting').value) || null,
    cost_domain: parseFloat(document.getElementById('schemaCostDomain').value) || null,
    cost_tools: parseFloat(document.getElementById('schemaCostTools').value) || null,
    cost_other: parseFloat(document.getElementById('schemaCostOther').value) || null,
    delivery_date: document.getElementById('schemaDeliveryDate').value || null,
    last_update: document.getElementById('schemaLastUpdate').value || null,
    last_maintenance: document.getElementById('schemaLastMaintenance').value || null,
    next_maintenance: document.getElementById('schemaNextMaintenance').value || null,
    domain_renewal: document.getElementById('schemaDomainRenewal').value || null,
    hosting_renewal: document.getElementById('schemaHostingRenewal').value || null,
    notes: document.getElementById('schemaNotes').value || null
  };
}

async function saveSchema() {
  const projectId = document.getElementById('schemaProjectId').value;
  if (!projectId) return;
  
  const schema = getSchemaFormData();
  
  const result = await supabase.from('projects').update({ schema }).eq('id', projectId);
  
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
    return;
  }
  
  // Update local data
  const project = projects.find(p => p.id === projectId);
  if (project) project.schema = schema;
  
  showToast('success', 'Sucesso', 'Schema salvo com sucesso!');
  renderSchemaView(project, schema);
  toggleSchemaEdit();
}

function renderSchemaView(project, schema) {
  const container = document.getElementById('schemaView');
  const client = clients.find(c => c.id === project.client_id);
  const s = schema || {};
  
  const statusLabels = {
    proposal: 'Proposta', development: 'Em Desenvolvimento', review: 'Em Revisão',
    active: 'Ativo', maintenance: 'Manutenção', paused: 'Pausado', cancelled: 'Cancelado'
  };
  const statusColors = {
    proposal: 'gray-500', development: 'accent-warning', review: 'accent-secondary',
    active: 'accent-success', maintenance: 'accent-primary', paused: 'gray-500', cancelled: 'accent-danger'
  };
  const chargeTypeLabels = { unico: 'Valor Único', mensal: 'Mensalidade', fixo: 'Valor Fixo Recorrente' };
  const sslLabels = { ativo: '🟢 Ativo', expirado: '🔴 Expirado', nenhum: '⚪ Nenhum' };

  const hasInfra = s.domain || s.hosting || s.database || s.ssl;
  const hasTech = s.frontend || s.backend || s.other_tech;
  const totalCosts = (s.cost_hosting || 0) + (s.cost_domain || 0) + (s.cost_tools || 0) + (s.cost_other || 0);
  const hasFinance = s.charge_type || s.monthly_fee || s.total_value || s.due_day || totalCosts > 0;
  const hasDates = s.delivery_date || s.last_update || s.last_maintenance || s.next_maintenance || s.domain_renewal || s.hosting_renewal;
  const isEmpty = !hasInfra && !hasTech && !hasFinance && !hasDates && !s.notes;

  if (isEmpty) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-20 h-20 rounded-2xl bg-accent-secondary/10 flex items-center justify-center mb-4">
          <i data-lucide="git-branch" class="w-10 h-10 text-accent-secondary/50"></i>
        </div>
        <h4 class="text-lg font-semibold text-gray-300 mb-2">Schema vazio</h4>
        <p class="text-sm text-gray-500 mb-6 max-w-md">Clique em "Editar" para preencher as informações do projeto como domínio, tecnologias, pagamentos e datas.</p>
        <button onclick="toggleSchemaEdit()" class="bg-accent-primary hover:bg-accent-primary/90 px-6 py-2.5 rounded-lg transition-colors text-sm font-medium">Começar a preencher</button>
      </div>`;
    return;
  }

  const fmtDate = (d) => d ? formatDate(d) : null;
  const fmtCurrency = (v) => v ? formatCurrency(v) : null;
  
  const nodeItem = (icon, label, value, color) => {
    if (!value) return '';
    return `<div class="flex items-center gap-2.5 py-1.5"><i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color} flex-shrink-0"></i><span class="text-xs text-gray-400">${label}</span><span class="text-sm font-medium text-gray-200 ml-auto text-right">${value}</span></div>`;
  };

  container.innerHTML = `
    <!-- Central project node -->
    <div class="flex flex-col items-center mb-6">
      <div class="glass rounded-2xl px-6 py-4 text-center schema-node-center relative">
        <div class="w-14 h-14 rounded-xl bg-accent-primary/20 flex items-center justify-center mx-auto mb-2"><i data-lucide="folder-open" class="w-7 h-7 text-accent-primary"></i></div>
        <h3 class="font-bold text-lg">${project.name}</h3>
        <p class="text-sm text-gray-400">${client?.name || 'Sem cliente'}</p>
        <span class="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-full bg-${statusColors[project.status]}/20 text-${statusColors[project.status]}">
          <span class="w-1.5 h-1.5 rounded-full bg-${statusColors[project.status]}"></span>${statusLabels[project.status] || project.status}
        </span>
        ${project.url ? `<a href="${project.url}" target="_blank" rel="noopener noreferrer" class="block mt-2 text-xs text-accent-primary hover:underline truncate max-w-[200px] mx-auto">${project.url}</a>` : ''}
      </div>
      <div class="w-px h-6 bg-dark-600"></div>
    </div>

    <!-- Branch nodes -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${hasInfra ? `
      <div class="schema-branch glass rounded-xl p-4 border-l-2 border-accent-primary/50">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center"><i data-lucide="server" class="w-4 h-4 text-accent-primary"></i></div>
          <h4 class="font-semibold text-sm text-accent-primary">Infraestrutura</h4>
        </div>
        <div class="space-y-0.5">
          ${nodeItem('globe', 'Domínio', s.domain, 'accent-primary')}
          ${nodeItem('cloud', 'Hospedagem', s.hosting, 'accent-primary')}
          ${nodeItem('database', 'Banco de Dados', s.database, 'accent-primary')}
          ${nodeItem('shield', 'SSL', s.ssl ? sslLabels[s.ssl] : null, 'accent-primary')}
        </div>
      </div>` : ''}

      ${hasTech ? `
      <div class="schema-branch glass rounded-xl p-4 border-l-2 border-accent-secondary/50">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent-secondary/20 flex items-center justify-center"><i data-lucide="cpu" class="w-4 h-4 text-accent-secondary"></i></div>
          <h4 class="font-semibold text-sm text-accent-secondary">Tecnologias</h4>
        </div>
        <div class="space-y-0.5">
          ${nodeItem('monitor', 'Frontend', s.frontend, 'accent-secondary')}
          ${nodeItem('terminal', 'Backend', s.backend, 'accent-secondary')}
          ${nodeItem('puzzle', 'Outros/APIs', s.other_tech, 'accent-secondary')}
        </div>
      </div>` : ''}

      ${hasFinance ? `
      <div class="schema-branch glass rounded-xl p-4 border-l-2 border-accent-success/50">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent-success/20 flex items-center justify-center"><i data-lucide="banknote" class="w-4 h-4 text-accent-success"></i></div>
          <h4 class="font-semibold text-sm text-accent-success">Financeiro</h4>
        </div>
        <div class="space-y-0.5">
          ${nodeItem('tag', 'Tipo', s.charge_type ? chargeTypeLabels[s.charge_type] || s.charge_type : null, 'accent-success')}
          ${nodeItem('wallet', 'Valor do Projeto', fmtCurrency(s.total_value), 'accent-success')}
          ${nodeItem('repeat', 'Mensalidade', fmtCurrency(s.monthly_fee), 'accent-success')}
          ${nodeItem('calendar', 'Vencimento', s.due_day ? 'Dia ' + s.due_day : null, 'accent-success')}
        </div>
        ${totalCosts > 0 ? '<div class="border-t border-dark-600 mt-2 pt-2"><p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Seus custos</p><div class="space-y-0.5">' +
          nodeItem('cloud', 'Hospedagem', fmtCurrency(s.cost_hosting), 'accent-success') +
          nodeItem('globe', 'Domínio/ano', fmtCurrency(s.cost_domain), 'accent-success') +
          nodeItem('puzzle', 'Ferramentas/APIs', fmtCurrency(s.cost_tools), 'accent-success') +
          nodeItem('more-horizontal', 'Outros', fmtCurrency(s.cost_other), 'accent-success') +
          '<div class="flex items-center gap-2.5 py-1.5 border-t border-dark-600 mt-1 pt-1.5"><i data-lucide="equal" class="w-3.5 h-3.5 text-accent-success flex-shrink-0"></i><span class="text-xs text-gray-400 font-medium">Total Custos</span><span class="text-sm font-bold text-accent-success ml-auto">' + fmtCurrency(totalCosts) + '</span></div></div></div>' : ''}
        ${s.monthly_fee && totalCosts > 0 ? '<div class="border-t border-dark-600 mt-2 pt-2"><div class="flex items-center gap-2.5 py-1"><i data-lucide="trending-up" class="w-3.5 h-3.5 text-accent-primary flex-shrink-0"></i><span class="text-xs text-gray-400">Lucro Mensal</span><span class="text-sm font-bold ' + ((s.monthly_fee - totalCosts) >= 0 ? 'text-accent-success' : 'text-accent-danger') + ' ml-auto">' + fmtCurrency(s.monthly_fee - totalCosts) + '</span></div></div>' : ''}
      </div>` : ''}

      ${hasDates ? `
      <div class="schema-branch glass rounded-xl p-4 border-l-2 border-accent-warning/50">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent-warning/20 flex items-center justify-center"><i data-lucide="calendar" class="w-4 h-4 text-accent-warning"></i></div>
          <h4 class="font-semibold text-sm text-accent-warning">Datas & Manutenção</h4>
        </div>
        <div class="space-y-0.5">
          ${nodeItem('check-circle', 'Entrega', fmtDate(s.delivery_date), 'accent-warning')}
          ${nodeItem('refresh-cw', 'Última Att.', fmtDate(s.last_update), 'accent-warning')}
          ${nodeItem('wrench', 'Última Manut.', fmtDate(s.last_maintenance), 'accent-warning')}
          ${nodeItem('clock', 'Próxima Manut.', fmtDate(s.next_maintenance), 'accent-warning')}
          ${nodeItem('globe', 'Renov. Domínio', fmtDate(s.domain_renewal), 'accent-warning')}
          ${nodeItem('cloud', 'Renov. Hospedagem', fmtDate(s.hosting_renewal), 'accent-warning')}
        </div>
      </div>` : ''}
    </div>

    ${s.notes ? `
    <div class="glass rounded-xl p-4 mt-4 border-l-2 border-gray-500/50">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center"><i data-lucide="file-text" class="w-4 h-4 text-gray-400"></i></div>
        <h4 class="font-semibold text-sm text-gray-400">Observações</h4>
      </div>
      <p class="text-sm text-gray-300 whitespace-pre-wrap">${s.notes}</p>
    </div>` : ''}
  `;
}

// ========== KANBAN ==========

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const columns = [
    { key: 'proposal', label: 'Proposta', color: 'gray-500', icon: 'file-text' },
    { key: 'development', label: 'Desenvolvimento', color: 'accent-warning', icon: 'code' },
    { key: 'review', label: 'Revisão', color: 'accent-secondary', icon: 'eye' },
    { key: 'active', label: 'Ativo', color: 'accent-success', icon: 'check-circle' },
    { key: 'maintenance', label: 'Manutenção', color: 'accent-primary', icon: 'wrench' },
    { key: 'paused', label: 'Pausado', color: 'gray-500', icon: 'pause' }
  ];

  board.innerHTML = columns.map(col => {
    const colProjects = projects.filter(p => p.status === col.key);
    return `
      <div class="flex flex-col kanban-col" data-status="${col.key}"
           ondragover="event.preventDefault(); this.classList.add('kanban-drag-over')"
           ondragleave="this.classList.remove('kanban-drag-over')"
           ondrop="kanbanDrop(event,'${col.key}'); this.classList.remove('kanban-drag-over')">
        <div class="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 px-1">
          <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-${col.color}/20 flex items-center justify-center">
            <i data-lucide="${col.icon}" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-${col.color}"></i>
          </div>
          <span class="text-xs sm:text-sm font-semibold truncate">${col.label}</span>
          <span class="ml-auto text-[10px] sm:text-xs text-gray-500 bg-dark-700 px-2 py-0.5 rounded-full">${colProjects.length}</span>
        </div>
        <div class="flex-1 kanban-drop-zone rounded-xl p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 min-h-[100px] sm:min-h-[150px] border border-dark-600/50 bg-dark-800/40">
          ${colProjects.length === 0 ? `<div class="flex flex-col items-center justify-center h-full py-6 sm:py-8 text-gray-600"><i data-lucide="inbox" class="w-5 h-5 sm:w-6 sm:h-6 mb-1.5 opacity-40"></i><p class="text-[10px] sm:text-xs">Vazio</p></div>` :
            colProjects.map(p => {
              const client = clients.find(c => c.id === p.client_id);
              return `
                <div class="kanban-card rounded-lg p-2 sm:p-3 cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-${col.color}/30"
                     draggable="true" data-project-id="${p.id}"
                     ondragstart="event.dataTransfer.setData('text/plain','${p.id}')">
                  <div class="w-full h-0.5 rounded-full bg-${col.color}/40 mb-2"></div>
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1 truncate">${p.name}</p>
                  <p class="text-[10px] sm:text-xs text-gray-500 truncate">${client?.name || ''}</p>
                  ${p.value ? `<p class="text-[10px] sm:text-xs font-semibold text-accent-primary mt-1">${formatCurrency(p.value)}</p>` : ''}
                  ${p.deadline ? `<p class="text-[10px] sm:text-xs text-gray-500 mt-1"><i data-lucide="clock" class="w-2.5 h-2.5 sm:w-3 sm:h-3 inline"></i> ${formatDate(p.deadline)}</p>` : ''}
                </div>`;
            }).join('')}
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
  initKanbanTouch();
}

// Touch drag-and-drop for mobile kanban
let touchDragState = null;

function initKanbanTouch() {
  const cards = document.querySelectorAll('.kanban-card');
  cards.forEach(card => {
    card.addEventListener('touchstart', kanbanTouchStart, { passive: false });
  });
}

function kanbanTouchStart(e) {
  const card = e.currentTarget;
  const touch = e.touches[0];
  const rect = card.getBoundingClientRect();

  // Create ghost element
  const ghost = card.cloneNode(true);
  ghost.id = 'kanban-ghost';
  ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${rect.width}px;opacity:0.85;transform:rotate(2deg);box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:none;`;
  ghost.style.left = (touch.clientX - rect.width / 2) + 'px';
  ghost.style.top = (touch.clientY - 20) + 'px';
  document.body.appendChild(ghost);

  card.style.opacity = '0.3';

  touchDragState = {
    projectId: card.dataset.projectId,
    originCard: card,
    ghost
  };

  document.addEventListener('touchmove', kanbanTouchMove, { passive: false });
  document.addEventListener('touchend', kanbanTouchEnd);
  document.addEventListener('touchcancel', kanbanTouchEnd);
}

function kanbanTouchMove(e) {
  if (!touchDragState) return;
  e.preventDefault();
  const touch = e.touches[0];
  const ghost = touchDragState.ghost;
  const w = ghost.offsetWidth;
  ghost.style.left = (touch.clientX - w / 2) + 'px';
  ghost.style.top = (touch.clientY - 20) + 'px';

  // Highlight column under finger
  document.querySelectorAll('.kanban-col').forEach(col => {
    const r = col.getBoundingClientRect();
    if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
      col.classList.add('kanban-touch-over');
    } else {
      col.classList.remove('kanban-touch-over');
    }
  });
}

async function kanbanTouchEnd(e) {
  if (!touchDragState) return;
  const { projectId, originCard, ghost } = touchDragState;

  // Find which column the finger ended on
  const touch = e.changedTouches[0];
  let targetStatus = null;
  document.querySelectorAll('.kanban-col').forEach(col => {
    const r = col.getBoundingClientRect();
    if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
      targetStatus = col.dataset.status;
    }
    col.classList.remove('kanban-touch-over');
  });

  ghost.remove();
  originCard.style.opacity = '';
  touchDragState = null;

  document.removeEventListener('touchmove', kanbanTouchMove);
  document.removeEventListener('touchend', kanbanTouchEnd);
  document.removeEventListener('touchcancel', kanbanTouchEnd);

  if (targetStatus && projectId) {
    const project = projects.find(p => p.id === projectId);
    if (project && project.status !== targetStatus) {
      const result = await supabase.from('projects').update({ status: targetStatus }).eq('id', projectId);
      if (!result.error) {
        project.status = targetStatus;
        renderKanban();
        showToast('success', 'Movido', 'Status do projeto atualizado!');
      }
    }
  }
}

async function kanbanDrop(event, newStatus) {
  event.preventDefault();
  const projectId = event.dataTransfer.getData('text/plain');
  if (!projectId) return;

  const result = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
  if (!result.error) {
    const project = projects.find(p => p.id === projectId);
    if (project) project.status = newStatus;
    renderKanban();
    showToast('success', 'Movido', 'Status do projeto atualizado!');
  }
}

// ========== INSIGHTS ==========

function renderInsights() {
  const container = document.getElementById('insightsContent');
  if (!container) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Monthly income
  const thisMonthIncome = transactions.filter(t => t.type === 'income' && new Date(t.date) >= startOfMonth).reduce((s, t) => s + parseFloat(t.value || 0), 0);
  const lastMonthIncome = transactions.filter(t => t.type === 'income' && new Date(t.date) >= startOfLastMonth && new Date(t.date) <= endOfLastMonth).reduce((s, t) => s + parseFloat(t.value || 0), 0);
  const incomeGrowth = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome * 100) : 0;

  // MRR
  const mrr = subscriptions.filter(s => s.status === 'active').reduce((s, sub) => s + parseFloat(sub.value || 0), 0);
  const totalCosts = fixedCosts.reduce((s, c) => {
    const v = parseFloat(c.value || 0);
    if (c.frequency === 'monthly') return s + v;
    if (c.frequency === 'quarterly') return s + v / 3;
    if (c.frequency === 'yearly') return s + v / 12;
    return s;
  }, 0);

  // Best client
  const clientRevenues = clients.map(c => {
    const pIds = projects.filter(p => p.client_id === c.id).map(p => p.id);
    const rev = transactions.filter(t => t.type === 'income' && pIds.includes(t.project_id)).reduce((s, t) => s + parseFloat(t.value || 0), 0);
    const subRev = subscriptions.filter(sub => sub.status === 'active' && pIds.includes(sub.project_id)).reduce((s, sub) => s + parseFloat(sub.value || 0), 0);
    return { name: c.name, total: rev + subRev * 12, monthly: subRev };
  }).sort((a, b) => b.total - a.total);

  const bestClient = clientRevenues[0];

  // Project stats
  const activeProjects = projects.filter(p => ['development', 'active', 'maintenance', 'review'].includes(p.status));
  const avgProjectValue = projects.length > 0 ? projects.reduce((s, p) => s + parseFloat(p.value || 0), 0) / projects.filter(p => p.value).length : 0;

  // Overdue subscriptions
  const overdueCount = subscriptions.filter(s => s.status === 'overdue').length;
  const pendingCount = subscriptions.filter(s => s.status === 'pending').length;

  // Months data for trend
  const monthsMap = {};
  transactions.forEach(t => {
    const m = t.date?.substring(0, 7);
    if (!m) return;
    if (!monthsMap[m]) monthsMap[m] = { income: 0, expense: 0 };
    if (t.type === 'income') monthsMap[m].income += parseFloat(t.value || 0);
    else monthsMap[m].expense += parseFloat(t.value || 0);
  });
  const sortedMonths = Object.keys(monthsMap).sort();

  const profitMargin = mrr > 0 ? ((mrr - totalCosts) / mrr * 100) : 0;

  // Build insights
  const insights = [];

  // Growth insight
  if (lastMonthIncome > 0) {
    insights.push({
      icon: incomeGrowth >= 0 ? 'trending-up' : 'trending-down',
      color: incomeGrowth >= 0 ? 'accent-success' : 'accent-danger',
      title: incomeGrowth >= 0 ? 'Crescimento Positivo' : 'Receita em Queda',
      text: `Sua receita ${incomeGrowth >= 0 ? 'cresceu' : 'caiu'} <strong>${Math.abs(incomeGrowth).toFixed(1)}%</strong> em relação ao mês passado.`,
      detail: `Este mês: ${formatCurrency(thisMonthIncome)} | Mês anterior: ${formatCurrency(lastMonthIncome)}`
    });
  }

  // MRR insight
  if (mrr > 0) {
    insights.push({
      icon: 'repeat', color: 'accent-primary',
      title: 'Receita Recorrente',
      text: `Seu MRR atual é de <strong>${formatCurrency(mrr)}</strong> com <strong>${subscriptions.filter(s => s.status === 'active').length}</strong> assinaturas ativas.`,
      detail: `ARR projetado: ${formatCurrency(mrr * 12)}`
    });
  }

  // Profit margin
  insights.push({
    icon: 'pie-chart', color: profitMargin >= 50 ? 'accent-success' : profitMargin >= 20 ? 'accent-warning' : 'accent-danger',
    title: 'Margem de Lucro',
    text: `Sua margem operacional é de <strong>${profitMargin.toFixed(1)}%</strong>.`,
    detail: `MRR: ${formatCurrency(mrr)} - Custos: ${formatCurrency(totalCosts)} = Lucro: ${formatCurrency(mrr - totalCosts)}`
  });

  // Best client
  if (bestClient && bestClient.total > 0) {
    insights.push({
      icon: 'crown', color: 'accent-warning',
      title: 'Melhor Cliente',
      text: `<strong>${bestClient.name}</strong> é seu cliente mais valioso com ${formatCurrency(bestClient.total)} em receita total.`,
      detail: bestClient.monthly > 0 ? `Mensalidade: ${formatCurrency(bestClient.monthly)}` : 'Sem mensalidade ativa'
    });
  }

  // Overdue alert
  if (overdueCount > 0 || pendingCount > 0) {
    insights.push({
      icon: 'alert-triangle', color: 'accent-danger',
      title: 'Atenção: Cobranças',
      text: `Você tem <strong>${overdueCount}</strong> mensalidade(s) atrasada(s) e <strong>${pendingCount}</strong> pendente(s).`,
      detail: `Total em risco: ${formatCurrency(subscriptions.filter(s => ['overdue', 'pending'].includes(s.status)).reduce((sum, s) => sum + parseFloat(s.value || 0), 0))}`
    });
  }

  // Average project value
  if (avgProjectValue > 0) {
    insights.push({
      icon: 'target', color: 'accent-secondary',
      title: 'Ticket Médio de Projetos',
      text: `O valor médio dos seus projetos é <strong>${formatCurrency(avgProjectValue)}</strong>.`,
      detail: `${projects.length} projetos total, ${activeProjects.length} ativos`
    });
  }

  // Suggestion: diversification
  if (clientRevenues.length > 0) {
    const topClientShare = bestClient ? (bestClient.total / Math.max(clientRevenues.reduce((s, c) => s + c.total, 0), 1) * 100) : 0;
    if (topClientShare > 50) {
      insights.push({
        icon: 'shield-alert', color: 'accent-warning',
        title: 'Risco de Concentração',
        text: `<strong>${topClientShare.toFixed(0)}%</strong> da sua receita vem de um único cliente. Considere diversificar.`,
        detail: `Cliente: ${bestClient.name}`
      });
    }
  }

  // Render
  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      <div class="glass rounded-xl p-3 sm:p-5">
        <p class="text-gray-400 text-xs sm:text-sm mb-0.5">MRR</p>
        <p class="text-base sm:text-2xl font-bold text-accent-success truncate">${formatCurrency(mrr)}</p>
      </div>
      <div class="glass rounded-xl p-3 sm:p-5">
        <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Custos Mensais</p>
        <p class="text-base sm:text-2xl font-bold text-accent-danger truncate">${formatCurrency(totalCosts)}</p>
      </div>
      <div class="glass rounded-xl p-3 sm:p-5">
        <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Lucro Líquido</p>
        <p class="text-base sm:text-2xl font-bold ${mrr - totalCosts >= 0 ? 'text-accent-success' : 'text-accent-danger'} truncate">${formatCurrency(mrr - totalCosts)}</p>
      </div>
      <div class="glass rounded-xl p-3 sm:p-5">
        <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Margem</p>
        <p class="text-base sm:text-2xl font-bold">${profitMargin.toFixed(1)}%</p>
      </div>
    </div>
    <!-- Insight Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      ${insights.map(i => `
        <div class="glass rounded-xl p-4 sm:p-5 border-l-2 border-${i.color}/50 fade-in">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-${i.color}/20 flex items-center justify-center flex-shrink-0">
              <i data-lucide="${i.icon}" class="w-5 h-5 text-${i.color}"></i>
            </div>
            <div class="min-w-0">
              <h4 class="font-semibold text-sm mb-1">${i.title}</h4>
              <p class="text-sm text-gray-300">${i.text}</p>
              <p class="text-xs text-gray-500 mt-1">${i.detail}</p>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <!-- Client Revenue Ranking -->
    ${clientRevenues.filter(c => c.total > 0).length > 0 ? `
    <div class="glass rounded-xl p-4 sm:p-6">
      <h4 class="font-semibold text-sm sm:text-base mb-4">Ranking de Clientes por Receita</h4>
      <div class="space-y-3">
        ${clientRevenues.filter(c => c.total > 0).slice(0, 10).map((c, i) => `
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full ${i === 0 ? 'bg-accent-warning/20 text-accent-warning' : i === 1 ? 'bg-gray-400/20 text-gray-400' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-dark-700 text-gray-500'} flex items-center justify-center text-xs font-bold flex-shrink-0">${i + 1}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm truncate">${c.name}</span>
                <span class="text-sm font-medium ml-2">${formatCurrency(c.total)}</span>
              </div>
              <div class="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full" style="width: ${(c.total / (clientRevenues[0]?.total || 1) * 100)}%"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  `;
  lucide.createIcons();
}

// ========== UPTIME MONITOR ==========

async function checkUptime(url, projectId) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const start = Date.now();
    await fetch(url, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    return { status: 'online', responseTime, checkedAt: new Date().toISOString() };
  } catch (e) {
    return { status: 'offline', responseTime: 0, checkedAt: new Date().toISOString() };
  }
}

async function checkAllUptime() {
  const projectsWithUrl = projects.filter(p => p.url);
  if (projectsWithUrl.length === 0) {
    showToast('info', 'Info', 'Nenhum projeto com URL cadastrada.');
    return;
  }

  showToast('info', 'Verificando...', 'Checando status dos sites...');

  const results = await Promise.all(
    projectsWithUrl.map(async p => {
      const result = await checkUptime(p.url, p.id);
      uptimeResults[p.id] = result;
      return { projectId: p.id, ...result };
    })
  );

  renderUptimeMonitor();
  renderUptimeBadges();
  showToast('success', 'Concluído', `${results.length} site(s) verificado(s)!`);
}

function renderUptimeBadges() {
  projects.forEach(p => {
    const badge = document.getElementById(`uptime-badge-${p.id}`);
    if (!badge) return;
    const res = uptimeResults[p.id];
    if (!res) { badge.innerHTML = ''; return; }
    badge.innerHTML = `<span class="w-2 h-2 rounded-full ${res.status === 'online' ? 'bg-accent-success pulse-dot' : 'bg-accent-danger'}"></span><span class="text-xs ${res.status === 'online' ? 'text-accent-success' : 'text-accent-danger'}">${res.status === 'online' ? res.responseTime + 'ms' : 'Offline'}</span>`;
  });
}

function renderUptimeMonitor() {
  const statsContainer = document.getElementById('uptimeStats');
  const grid = document.getElementById('uptimeGrid');
  if (!statsContainer || !grid) return;

  const projectsWithUrl = projects.filter(p => p.url);
  const online = projectsWithUrl.filter(p => uptimeResults[p.id]?.status === 'online').length;
  const offline = projectsWithUrl.filter(p => uptimeResults[p.id]?.status === 'offline').length;
  const unchecked = projectsWithUrl.filter(p => !uptimeResults[p.id]).length;
  const avgTime = projectsWithUrl.filter(p => uptimeResults[p.id]?.status === 'online').reduce((s, p) => s + (uptimeResults[p.id]?.responseTime || 0), 0) / (online || 1);

  statsContainer.innerHTML = `
    <div class="glass rounded-xl p-3 sm:p-5">
      <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Online</p>
      <p class="text-base sm:text-2xl font-bold text-accent-success">${online}</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-5">
      <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Offline</p>
      <p class="text-base sm:text-2xl font-bold text-accent-danger">${offline}</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-5">
      <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Não Verificados</p>
      <p class="text-base sm:text-2xl font-bold text-gray-400">${unchecked}</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-5">
      <p class="text-gray-400 text-xs sm:text-sm mb-0.5">Tempo Médio</p>
      <p class="text-base sm:text-2xl font-bold">${avgTime.toFixed(0)}ms</p>
    </div>
  `;

  if (projectsWithUrl.length === 0) {
    grid.innerHTML = '<div class="glass rounded-xl p-8 text-center text-gray-500 col-span-full">Nenhum projeto com URL cadastrada. Adicione URLs nos projetos para monitorar.</div>';
    lucide.createIcons();
    return;
  }

  grid.innerHTML = projectsWithUrl.map(p => {
    const res = uptimeResults[p.id];
    const client = clients.find(c => c.id === p.client_id);
    const statusIcon = !res ? 'help-circle' : res.status === 'online' ? 'check-circle' : 'x-circle';
    const statusColor = !res ? 'gray-500' : res.status === 'online' ? 'accent-success' : 'accent-danger';
    const statusText = !res ? 'Não verificado' : res.status === 'online' ? `Online (${res.responseTime}ms)` : 'Offline';

    return `
      <div class="glass rounded-xl p-4 hover:border-${statusColor}/30 transition-all">
        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0">
            <h4 class="font-semibold text-sm truncate">${p.name}</h4>
            <p class="text-xs text-gray-500 truncate">${client?.name || ''}</p>
          </div>
          <div class="w-8 h-8 rounded-lg bg-${statusColor}/20 flex items-center justify-center flex-shrink-0">
            <i data-lucide="${statusIcon}" class="w-4 h-4 text-${statusColor}"></i>
          </div>
        </div>
        <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-accent-primary hover:underline truncate block mb-2">${p.url}</a>
        <div class="flex items-center justify-between">
          <span class="text-xs text-${statusColor} font-medium">${statusText}</span>
          ${res?.checkedAt ? `<span class="text-xs text-gray-600">${new Date(res.checkedAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>` : ''}
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

// Silent auto-refresh uptime (every 30min)
async function checkAllUptimeSilent() {
  const projectsWithUrl = projects.filter(p => p.url);
  if (projectsWithUrl.length === 0) return;

  const results = await Promise.all(
    projectsWithUrl.map(async p => {
      const result = await checkUptime(p.url, p.id);
      uptimeResults[p.id] = result;
      return { project: p, ...result };
    })
  );

  const offlineSites = results.filter(r => r.status === 'offline');
  if (offlineSites.length > 0) {
    offlineSites.forEach(site => {
      addNotification('error', `${site.project.name} está OFFLINE`, site.project.url);
    });
    showToast('error', 'Alerta Uptime', `${offlineSites.length} site(s) offline detectado(s)!`);
  }

  renderUptimeMonitor();
  renderUptimeBadges();
}

// ========== NOTIFICATIONS ==========

function loadNotifications() {
  try {
    const saved = localStorage.getItem('sitemanager_notifications');
    if (saved) notifications = JSON.parse(saved);
  } catch(e) {}
  updateNotificationBadge();
}

function saveNotifications() {
  try { localStorage.setItem('sitemanager_notifications', JSON.stringify(notifications.slice(0, 50))); } catch(e) {}
}

function addNotification(type, message, detail) {
  notifications.unshift({
    id: Date.now().toString(),
    type,
    message,
    detail: detail || '',
    time: new Date().toISOString(),
    read: false
  });
  saveNotifications();
  updateNotificationBadge();
  if (notificationsOpen) renderNotificationPanel();
}

function updateNotificationBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const unread = notifications.filter(n => !n.read).length;
  badge.style.display = unread > 0 ? 'block' : 'none';
  badge.textContent = unread > 9 ? '9+' : unread;
}

function toggleNotifications() {
  notificationsOpen = !notificationsOpen;
  const panel = document.getElementById('notifPanel');
  if (notificationsOpen) {
    panel.classList.remove('hidden');
    renderNotificationPanel();
  } else {
    panel.classList.add('hidden');
  }
}

function markAllNotificationsRead() {
  notifications.forEach(n => n.read = true);
  saveNotifications();
  updateNotificationBadge();
  renderNotificationPanel();
}

function clearAllNotifications() {
  notifications = [];
  saveNotifications();
  updateNotificationBadge();
  renderNotificationPanel();
}

function renderNotificationPanel() {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Nenhuma notificação</div>';
    return;
  }

  const icons = { error: 'alert-circle', warning: 'alert-triangle', info: 'info', success: 'check-circle' };
  const colors = { error: 'accent-danger', warning: 'accent-warning', info: 'accent-primary', success: 'accent-success' };

  list.innerHTML = notifications.slice(0, 20).map(n => {
    const icon = icons[n.type] || 'info';
    const color = colors[n.type] || 'accent-primary';
    const time = new Date(n.time);
    const timeStr = time.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `
      <div class="px-4 py-3 hover:bg-dark-700 transition-colors ${n.read ? 'opacity-60' : ''} border-b border-dark-600 last:border-0">
        <div class="flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg bg-${color}/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">${n.message}</p>
            ${n.detail ? `<p class="text-xs text-gray-500 truncate">${n.detail}</p>` : ''}
            <p class="text-xs text-gray-600 mt-0.5">${timeStr}</p>
          </div>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

// ========== SERVICE OPTIONS (Proposal Checkboxes) ==========

function loadServiceOptions() {
  try {
    const saved = localStorage.getItem('sitemanager_services');
    if (saved) serviceOptions = JSON.parse(saved);
  } catch(e) {}
}

function saveServiceOptions() {
  try { localStorage.setItem('sitemanager_services', JSON.stringify(serviceOptions)); } catch(e) {}
}

function addServiceOption() {
  const name = document.getElementById('newServiceName')?.value?.trim();
  const price = parseFloat(document.getElementById('newServicePrice')?.value) || 0;
  const billing = document.getElementById('newServiceBilling')?.value || 'unique';
  if (!name) { showToast('error', 'Erro', 'Digite o nome do serviço.'); return; }

  serviceOptions.push({ id: Date.now().toString(), name, price, billing });
  saveServiceOptions();
  document.getElementById('newServiceName').value = '';
  document.getElementById('newServicePrice').value = '';
  document.getElementById('newServiceBilling').value = 'unique';
  renderProposalItems();
}

function removeServiceOption(id) {
  serviceOptions = serviceOptions.filter(s => s.id !== id);
  saveServiceOptions();
  proposalItems = proposalItems.filter(pi => serviceOptions.some(s => s.id === pi.serviceId));
  renderProposalItems();
}

function toggleProposalService(serviceId, checked) {
  if (checked) {
    const svc = serviceOptions.find(s => s.id === serviceId);
    if (svc && !proposalItems.find(pi => pi.serviceId === serviceId)) {
      proposalItems.push({ serviceId, description: svc.name, quantity: 1, price: svc.price, billing: svc.billing || 'unique' });
    }
  } else {
    proposalItems = proposalItems.filter(pi => pi.serviceId !== serviceId);
  }
  renderProposalItems();
}

function updateProposalServiceQty(serviceId, qty) {
  const item = proposalItems.find(pi => pi.serviceId === serviceId);
  if (item) item.quantity = parseInt(qty) || 1;
  updateProposalTotal();
}

function updateProposalServicePrice(serviceId, price) {
  const item = proposalItems.find(pi => pi.serviceId === serviceId);
  if (item) item.price = parseFloat(price) || 0;
  updateProposalTotal();
}

// ========== CHANGELOG ==========

function openChangelog(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  document.getElementById('changelogProjectId').value = projectId;
  document.getElementById('changelogModalTitle').textContent = `Changelog — ${project.name}`;
  document.getElementById('changelogText').value = '';

  renderChangelogTimeline(project);
  document.getElementById('changelogModal').classList.remove('hidden');
  lucide.createIcons();
}

async function addChangelogEntry(event) {
  event.preventDefault();
  const projectId = document.getElementById('changelogProjectId').value;
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  const type = document.getElementById('changelogType').value;
  const text = document.getElementById('changelogText').value.trim();
  if (!text) return;

  const changelog = project.changelog || [];
  changelog.unshift({
    type,
    text,
    date: new Date().toISOString()
  });

  const result = await supabase.from('projects').update({ changelog }).eq('id', projectId);
  if (result.error) {
    showToast('error', 'Erro', result.error.message);
    return;
  }

  project.changelog = changelog;
  document.getElementById('changelogText').value = '';
  renderChangelogTimeline(project);
  showToast('success', 'Adicionado', 'Entrada no changelog registrada!');
}

function deleteChangelogEntry(projectId, index) {
  const project = projects.find(p => p.id === projectId);
  if (!project || !project.changelog) return;

  project.changelog.splice(index, 1);
  supabase.from('projects').update({ changelog: project.changelog }).eq('id', projectId);
  renderChangelogTimeline(project);
}

function renderChangelogTimeline(project) {
  const container = document.getElementById('changelogTimeline');
  const changelog = project.changelog || [];

  const typeConfig = {
    update: { icon: 'refresh-cw', color: 'accent-primary', label: 'Atualização' },
    fix: { icon: 'bug', color: 'accent-danger', label: 'Correção' },
    deploy: { icon: 'rocket', color: 'accent-success', label: 'Deploy' },
    feature: { icon: 'sparkles', color: 'accent-secondary', label: 'Nova Feature' },
    maintenance: { icon: 'wrench', color: 'accent-warning', label: 'Manutenção' }
  };

  if (changelog.length === 0) {
    container.innerHTML = '<div class="text-center py-12 text-gray-500"><i data-lucide="history" class="w-12 h-12 mx-auto mb-3 opacity-30"></i><p class="text-sm">Nenhuma entrada no changelog.</p><p class="text-xs mt-1">Adicione registros acima para manter o histórico.</p></div>';
    lucide.createIcons();
    return;
  }

  container.innerHTML = changelog.map((entry, i) => {
    const cfg = typeConfig[entry.type] || typeConfig.update;
    const date = new Date(entry.date);
    return `
      <div class="flex gap-3 fade-in">
        <div class="flex flex-col items-center flex-shrink-0">
          <div class="w-8 h-8 rounded-lg bg-${cfg.color}/20 flex items-center justify-center">
            <i data-lucide="${cfg.icon}" class="w-4 h-4 text-${cfg.color}"></i>
          </div>
          ${i < changelog.length - 1 ? '<div class="w-px flex-1 bg-dark-600 mt-1"></div>' : ''}
        </div>
        <div class="glass rounded-lg p-3 flex-1 mb-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <span class="text-xs font-medium text-${cfg.color}">${cfg.label}</span>
              <p class="text-sm mt-0.5">${entry.text}</p>
              <p class="text-xs text-gray-500 mt-1">${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</p>
            </div>
            <button onclick="deleteChangelogEntry('${project.id}', ${i})" class="p-1 hover:bg-dark-600 rounded text-gray-600 hover:text-accent-danger transition-colors flex-shrink-0">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

// ========== PROPOSAL GENERATOR ==========

function openProposalModal(editData) {
  // Reset / populate
  document.getElementById('proposalClient').innerHTML = '<option value="">Selecione</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('proposalProjectName').value = editData?.projectName || '';
  document.getElementById('proposalDescription').value = editData?.description || '';
  document.getElementById('proposalValidity').value = editData?.validity || 15;
  document.getElementById('proposalDeadline').value = editData?.deadline || '';
  document.getElementById('proposalNotes').value = editData?.notes || '';
  if (editData?.clientId) document.getElementById('proposalClient').value = editData.clientId;

  proposalItems = editData?.items || [];
  renderProposalItems();

  document.getElementById('proposalForm').classList.remove('hidden');
  document.getElementById('proposalPreview').classList.add('hidden');
  document.getElementById('proposalPrintBtn').classList.add('hidden');
  document.getElementById('proposalModalTitle').textContent = editData ? 'Editar Proposta' : 'Nova Proposta';

  document.getElementById('proposalModal').classList.remove('hidden');
  lucide.createIcons();
}

function addProposalItem() {
  // No longer used - items come from checkbox selection
}

function removeProposalItem(index) {
  proposalItems.splice(index, 1);
  renderProposalItems();
}

function updateProposalItem(index, field, value) {
  proposalItems[index][field] = field === 'description' ? value : parseFloat(value) || 0;
  updateProposalTotal();
}

function updateProposalTotal() {
  const total = proposalItems.reduce((s, item) => s + (item.quantity * item.price), 0);
  document.getElementById('proposalTotal').textContent = formatCurrency(total);
}

function renderProposalItems() {
  const container = document.getElementById('proposalItems');
  const billingLabels = { unique: 'Único', monthly: 'Mensal', hourly: 'Hora' };
  
  // Add new service input
  let html = `
    <div class="flex items-center gap-2 mb-3 pb-3 border-b border-dark-600 flex-wrap sm:flex-nowrap">
      <input type="text" id="newServiceName" placeholder="Nome do serviço" class="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary min-w-0">
      <select id="newServiceBilling" class="bg-dark-700 border border-dark-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent-primary w-24">
        <option value="unique">Único</option>
        <option value="monthly">Mensal</option>
        <option value="hourly">Hora</option>
      </select>
      <input type="number" id="newServicePrice" step="0.01" placeholder="Preço" class="w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:border-accent-primary">
      <button onclick="addServiceOption()" class="p-2 bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 rounded-lg transition-colors"><i data-lucide="plus" class="w-4 h-4"></i></button>
    </div>`;

  if (serviceOptions.length === 0) {
    html += '<p class="text-xs text-gray-500 text-center py-2">Crie serviços acima para selecionar na proposta.</p>';
  } else {
    html += serviceOptions.map(svc => {
      const isChecked = proposalItems.some(pi => pi.serviceId === svc.id);
      const item = proposalItems.find(pi => pi.serviceId === svc.id);
      const bl = billingLabels[svc.billing] || 'Único';
      const billingColor = svc.billing === 'monthly' ? 'accent-warning' : svc.billing === 'hourly' ? 'accent-secondary' : 'gray-500';
      return `
        <div class="flex items-center gap-2 py-1.5">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleProposalService('${svc.id}', this.checked)" class="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer">
          <span class="flex-1 text-sm truncate ${isChecked ? 'text-white' : 'text-gray-400'}">${svc.name}</span>
          <span class="text-[10px] bg-${billingColor}/20 text-${billingColor} px-1.5 py-0.5 rounded flex-shrink-0">${bl}</span>
          ${isChecked ? `
            <input type="number" value="${item.quantity}" min="1" onchange="updateProposalServiceQty('${svc.id}', this.value)" class="w-14 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent-primary">
            <input type="number" value="${item.price}" step="0.01" onchange="updateProposalServicePrice('${svc.id}', this.value)" class="w-24 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-accent-primary">
          ` : `<span class="text-xs text-gray-500 w-24 text-right">${formatCurrency(svc.price)}</span>`}
          <button onclick="removeServiceOption('${svc.id}')" class="p-1 hover:bg-dark-600 rounded text-gray-600 hover:text-accent-danger transition-colors flex-shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`;
    }).join('');
  }

  container.innerHTML = html;
  updateProposalTotal();
  lucide.createIcons();
}

function previewProposal() {
  const clientId = document.getElementById('proposalClient').value;
  const client = clients.find(c => c.id === clientId);
  const projectName = document.getElementById('proposalProjectName').value || 'Projeto';
  const description = document.getElementById('proposalDescription').value;
  const validity = document.getElementById('proposalValidity').value;
  const deadline = document.getElementById('proposalDeadline').value;
  const notes = document.getElementById('proposalNotes').value;
  const total = proposalItems.reduce((s, item) => s + (item.quantity * item.price), 0);
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + parseInt(validity || 15));

  document.getElementById('proposalForm').classList.add('hidden');
  document.getElementById('proposalPreview').classList.remove('hidden');
  document.getElementById('proposalPrintBtn').classList.remove('hidden');
  document.getElementById('proposalModalTitle').textContent = 'Visualizar Proposta';

  document.getElementById('proposalPreview').innerHTML = `
    <div id="proposalPrintArea" class="bg-dark-800 rounded-2xl p-6 sm:p-10 space-y-8 print-area">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-2xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">SiteManager</h2>
          <p class="text-sm text-gray-500">Proposta Comercial</p>
        </div>
        <div class="text-right text-sm text-gray-400">
          <p>Data: ${today.toLocaleDateString('pt-BR')}</p>
          <p>Válida até: ${validUntil.toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
      <div class="border-t border-dark-600 pt-6">
        <div class="grid grid-cols-2 gap-6">
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
            <p class="font-semibold">${client?.name || 'N/A'}</p>
            ${client?.email ? `<p class="text-sm text-gray-400">${client.email}</p>` : ''}
            ${client?.company ? `<p class="text-sm text-gray-400">${client.company}</p>` : ''}
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Projeto</p>
            <p class="font-semibold">${projectName}</p>
            ${deadline ? `<p class="text-sm text-gray-400">Prazo: ${deadline}</p>` : ''}
          </div>
        </div>
      </div>
      ${description ? `<div class="border-t border-dark-600 pt-6"><p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Escopo do Projeto</p><p class="text-sm text-gray-300 whitespace-pre-wrap">${description}</p></div>` : ''}
      <div class="border-t border-dark-600 pt-6">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-3">Itens & Investimento</p>
        <table class="w-full text-sm">
          <thead><tr class="text-gray-400 text-left"><th class="pb-2">Descrição</th><th class="pb-2 text-center w-20">Tipo</th><th class="pb-2 text-center w-16">Qtd</th><th class="pb-2 text-right w-28">Valor Unit.</th><th class="pb-2 text-right w-28">Subtotal</th></tr></thead>
          <tbody>
            ${proposalItems.filter(item => item.description).map(item => {
              const billingLabel = item.billing === 'monthly' ? 'Mensal' : item.billing === 'hourly' ? '/hora' : 'Único';
              return `
              <tr class="border-t border-dark-600">
                <td class="py-2">${item.description}</td>
                <td class="py-2 text-center"><span class="text-xs px-1.5 py-0.5 rounded ${item.billing === 'monthly' ? 'bg-yellow-500/20 text-yellow-400' : item.billing === 'hourly' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}">${billingLabel}</span></td>
                <td class="py-2 text-center">${item.quantity}</td>
                <td class="py-2 text-right">${formatCurrency(item.price)}</td>
                <td class="py-2 text-right font-medium">${formatCurrency(item.quantity * item.price)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-accent-primary/30">
              <td colspan="4" class="pt-3 text-right font-semibold">Total</td>
              <td class="pt-3 text-right text-lg font-bold text-accent-primary">${formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${notes ? `<div class="border-t border-dark-600 pt-6"><p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Condições & Observações</p><p class="text-sm text-gray-300 whitespace-pre-wrap">${notes}</p></div>` : ''}
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="backToProposalForm()" class="flex-1 bg-dark-700 hover:bg-dark-600 px-4 py-3 rounded-lg transition-colors text-sm">Voltar e Editar</button>
      <button onclick="saveProposal()" class="flex-1 bg-accent-primary hover:bg-accent-primary/90 px-4 py-3 rounded-lg transition-colors text-sm font-medium">Salvar Proposta</button>
    </div>
  `;
  lucide.createIcons();
}

function backToProposalForm() {
  document.getElementById('proposalForm').classList.remove('hidden');
  document.getElementById('proposalPreview').classList.add('hidden');
  document.getElementById('proposalPrintBtn').classList.add('hidden');
  document.getElementById('proposalModalTitle').textContent = 'Nova Proposta';
}

function printProposal() {
  const area = document.getElementById('proposalPrintArea');
  if (!area) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Proposta</title><style>
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background: #12121a; color: #e5e7eb; padding: 40px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 4px; }
    .text-accent-primary { color: #6366f1; }
  </style></head><body>${area.innerHTML}</body></html>`);
  w.document.close();
  w.print();
}

function saveProposal() {
  const clientId = document.getElementById('proposalClient').value;
  const client = clients.find(c => c.id === clientId);

  const proposal = {
    id: Date.now().toString(),
    clientId,
    clientName: client?.name || 'N/A',
    projectName: document.getElementById('proposalProjectName').value,
    description: document.getElementById('proposalDescription').value,
    items: [...proposalItems],
    total: proposalItems.reduce((s, item) => s + (item.quantity * item.price), 0),
    validity: document.getElementById('proposalValidity').value,
    deadline: document.getElementById('proposalDeadline').value,
    notes: document.getElementById('proposalNotes').value,
    createdAt: new Date().toISOString()
  };

  proposals.push(proposal);
  try { localStorage.setItem('sitemanager_proposals', JSON.stringify(proposals)); } catch(e) {}
  closeModal('proposalModal');
  if (currentSection === 'proposals') renderProposals();
  showToast('success', 'Salvo', 'Proposta salva com sucesso!');
}

function loadProposals() {
  try {
    const saved = localStorage.getItem('sitemanager_proposals');
    if (saved) proposals = JSON.parse(saved);
  } catch(e) {}
}

function deleteProposal(id) {
  proposals = proposals.filter(p => p.id !== id);
  try { localStorage.setItem('sitemanager_proposals', JSON.stringify(proposals)); } catch(e) {}
  renderProposals();
  showToast('success', 'Excluída', 'Proposta removida!');
}

function renderProposals() {
  const grid = document.getElementById('proposalsGrid');
  if (!grid) return;

  if (proposals.length === 0) {
    grid.innerHTML = '<div class="glass rounded-xl p-8 text-center text-gray-500 col-span-full">Nenhuma proposta criada. Clique em "Nova Proposta" para começar.</div>';
    return;
  }

  grid.innerHTML = proposals.map(p => {
    const date = new Date(p.createdAt);
    return `
      <div class="glass rounded-xl p-5 hover:border-accent-primary/30 transition-all">
        <div class="flex items-start justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center">
            <i data-lucide="file-text" class="w-5 h-5 text-accent-primary"></i>
          </div>
          <span class="text-xs text-gray-500">${date.toLocaleDateString('pt-BR')}</span>
        </div>
        <h4 class="font-semibold text-sm mb-1 truncate">${p.projectName || 'Proposta'}</h4>
        <p class="text-xs text-gray-500 mb-3">${p.clientName}</p>
        <p class="text-lg font-bold text-accent-primary mb-3">${formatCurrency(p.total)}</p>
        <div class="flex gap-2 pt-3 border-t border-dark-600">
          <button onclick="openProposalModal({clientId:'${p.clientId}',projectName:'${(p.projectName||'').replace(/'/g,"\\'")}',description:proposals.find(x=>x.id==='${p.id}')?.description||'',items:proposals.find(x=>x.id==='${p.id}')?.items||[],validity:'${p.validity}',deadline:'${p.deadline||''}',notes:proposals.find(x=>x.id==='${p.id}')?.notes||''})" class="flex items-center gap-1 text-xs bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 px-2.5 py-1.5 rounded-lg transition-colors">
            <i data-lucide="eye" class="w-3 h-3"></i> Ver
          </button>
          <button onclick="deleteProposal('${p.id}')" class="flex items-center gap-1 text-xs bg-dark-700 text-gray-400 hover:bg-accent-danger/20 hover:text-accent-danger px-2.5 py-1.5 rounded-lg transition-colors ml-auto">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
          </button>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

// ========== IDEAS ==========

function loadIdeas() {
  try {
    const saved = localStorage.getItem('sitemanager_ideas');
    if (saved) ideas = JSON.parse(saved);
  } catch(e) {}
}

function saveIdeasStorage() {
  try { localStorage.setItem('sitemanager_ideas', JSON.stringify(ideas)); } catch(e) {}
}

function openIdeaModal(editId) {
  document.getElementById('ideaId').value = '';
  document.getElementById('ideaTitle').value = '';
  document.getElementById('ideaDescription').value = '';
  document.getElementById('ideaCategory').value = 'site';
  document.getElementById('ideaEstimatedValue').value = '';
  document.getElementById('ideaClient').value = '';
  document.getElementById('ideaPriority').value = 'medium';
  document.getElementById('ideaStatus').value = 'new';
  document.getElementById('ideaNotes').value = '';
  document.getElementById('ideaModalTitle').textContent = 'Nova Ideia';

  if (editId) {
    const idea = ideas.find(i => i.id === editId);
    if (idea) {
      document.getElementById('ideaId').value = idea.id;
      document.getElementById('ideaTitle').value = idea.title;
      document.getElementById('ideaDescription').value = idea.description || '';
      document.getElementById('ideaCategory').value = idea.category || 'site';
      document.getElementById('ideaEstimatedValue').value = idea.estimatedValue || '';
      document.getElementById('ideaClient').value = idea.client || '';
      document.getElementById('ideaPriority').value = idea.priority || 'medium';
      document.getElementById('ideaStatus').value = idea.status || 'new';
      document.getElementById('ideaNotes').value = idea.notes || '';
      document.getElementById('ideaModalTitle').textContent = 'Editar Ideia';
    }
  }

  document.getElementById('ideaModal').classList.remove('hidden');
  lucide.createIcons();
}

function saveIdea(event) {
  event.preventDefault();
  const id = document.getElementById('ideaId').value;
  const now = new Date().toISOString();

  const ideaData = {
    id: id || Date.now().toString(),
    title: document.getElementById('ideaTitle').value.trim(),
    description: document.getElementById('ideaDescription').value.trim(),
    category: document.getElementById('ideaCategory').value,
    estimatedValue: parseFloat(document.getElementById('ideaEstimatedValue').value) || 0,
    client: document.getElementById('ideaClient').value.trim(),
    priority: document.getElementById('ideaPriority').value,
    status: document.getElementById('ideaStatus').value,
    notes: document.getElementById('ideaNotes').value.trim(),
    createdAt: id ? (ideas.find(i => i.id === id)?.createdAt || now) : now,
    updatedAt: now
  };

  if (id) {
    const idx = ideas.findIndex(i => i.id === id);
    if (idx >= 0) ideas[idx] = ideaData;
  } else {
    ideas.unshift(ideaData);
  }

  saveIdeasStorage();
  closeModal('ideaModal');
  if (currentSection === 'ideas') renderIdeas();
  showToast('success', 'Salvo', 'Ideia salva com sucesso!');
}

function deleteIdea(id) {
  ideas = ideas.filter(i => i.id !== id);
  saveIdeasStorage();
  renderIdeas();
  showToast('success', 'Excluída', 'Ideia removida!');
}

function executeIdea(id) {
  const idea = ideas.find(i => i.id === id);
  if (!idea) return;
  idea.status = 'executed';
  idea.executedAt = new Date().toISOString();
  saveIdeasStorage();
  renderIdeas();
  showToast('success', 'Executada!', `"${idea.title}" marcada como executada. Crie o projeto/cliente correspondente.`);
}

function filterIdeas(filter) {
  currentIdeaFilter = filter;
  document.querySelectorAll('.idea-filter-btn').forEach(btn => {
    btn.classList.remove('bg-accent-primary/20', 'text-accent-primary');
    btn.classList.add('bg-dark-700', 'text-gray-400');
    if (btn.dataset.filter === filter) {
      btn.classList.remove('bg-dark-700', 'text-gray-400');
      btn.classList.add('bg-accent-primary/20', 'text-accent-primary');
    }
  });
  renderIdeas();
}

function renderIdeas() {
  renderIdeasStats();
  const grid = document.getElementById('ideasGrid');
  if (!grid) return;

  const now = new Date();
  const STALLED_DAYS = 30;

  let filtered = [...ideas];
  if (currentIdeaFilter === 'stalled') {
    filtered = filtered.filter(i => {
      if (i.status === 'executed' || i.status === 'rejected') return false;
      const updated = new Date(i.updatedAt || i.createdAt);
      return (now - updated) / (1000 * 60 * 60 * 24) > STALLED_DAYS;
    });
  } else if (currentIdeaFilter !== 'all') {
    filtered = filtered.filter(i => i.status === currentIdeaFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="glass rounded-xl p-8 text-center text-gray-500 col-span-full">Nenhuma ideia encontrada neste filtro.</div>';
    return;
  }

  const statusConfig = {
    new: { label: 'Nova', color: 'accent-primary', icon: 'sparkles' },
    evaluating: { label: 'Avaliando', color: 'accent-warning', icon: 'search' },
    approved: { label: 'Aprovada', color: 'accent-success', icon: 'check' },
    rejected: { label: 'Descartada', color: 'accent-danger', icon: 'x' },
    executed: { label: 'Executada', color: 'accent-secondary', icon: 'rocket' }
  };
  const priorityConfig = {
    low: { label: 'Baixa', color: 'gray-500' },
    medium: { label: 'Média', color: 'accent-warning' },
    high: { label: 'Alta', color: 'accent-danger' }
  };
  const categoryLabels = { site: 'Site', ecommerce: 'E-commerce', app: 'App', sistema: 'Sistema', redesign: 'Redesign', outro: 'Outro' };

  grid.innerHTML = filtered.map(idea => {
    const st = statusConfig[idea.status] || statusConfig.new;
    const pr = priorityConfig[idea.priority] || priorityConfig.medium;
    const created = new Date(idea.createdAt);
    const updated = new Date(idea.updatedAt || idea.createdAt);
    const daysAgo = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    const isStalled = daysAgo > STALLED_DAYS && idea.status !== 'executed' && idea.status !== 'rejected';

    return `
      <div class="glass rounded-xl p-4 sm:p-5 hover:border-${st.color}/30 transition-all ${isStalled ? 'border-accent-warning/40' : ''}">
        <div class="flex items-start justify-between mb-3">
          <div class="w-9 h-9 rounded-xl bg-${st.color}/20 flex items-center justify-center">
            <i data-lucide="${st.icon}" class="w-4 h-4 text-${st.color}"></i>
          </div>
          <div class="flex items-center gap-1.5">
            ${isStalled ? '<span class="text-[10px] bg-accent-warning/20 text-accent-warning px-1.5 py-0.5 rounded-full">Parada</span>' : ''}
            <span class="text-[10px] sm:text-xs bg-${st.color}/20 text-${st.color} px-2 py-0.5 rounded-full">${st.label}</span>
          </div>
        </div>
        <h4 class="font-semibold text-sm mb-1 truncate">${idea.title}</h4>
        ${idea.client ? `<p class="text-xs text-gray-500 mb-1"><i data-lucide="user" class="w-3 h-3 inline"></i> ${idea.client}</p>` : ''}
        ${idea.description ? `<p class="text-xs text-gray-400 mb-2 line-clamp-2">${idea.description}</p>` : ''}
        <div class="flex flex-wrap gap-1.5 mb-3">
          <span class="text-[10px] bg-dark-700 text-gray-400 px-1.5 py-0.5 rounded">${categoryLabels[idea.category] || idea.category}</span>
          <span class="text-[10px] bg-${pr.color}/20 text-${pr.color} px-1.5 py-0.5 rounded">${pr.label}</span>
          ${idea.estimatedValue ? `<span class="text-[10px] bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded">${formatCurrency(idea.estimatedValue)}</span>` : ''}
        </div>
        <div class="flex items-center justify-between text-[10px] text-gray-600 mb-3">
          <span>${created.toLocaleDateString('pt-BR')}</span>
          <span>${daysAgo === 0 ? 'Hoje' : daysAgo + 'd atrás'}</span>
        </div>
        <div class="flex gap-1.5 pt-2 border-t border-dark-600">
          ${idea.status !== 'executed' ? `
            <button onclick="executeIdea('${idea.id}')" class="flex items-center gap-1 text-xs bg-accent-success/20 text-accent-success hover:bg-accent-success/30 px-2 py-1.5 rounded-lg transition-colors">
              <i data-lucide="rocket" class="w-3 h-3"></i> Executar
            </button>` : ''}
          <button onclick="openIdeaModal('${idea.id}')" class="flex items-center gap-1 text-xs bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 px-2 py-1.5 rounded-lg transition-colors">
            <i data-lucide="pencil" class="w-3 h-3"></i> Editar
          </button>
          <button onclick="deleteIdea('${idea.id}')" class="flex items-center gap-1 text-xs bg-dark-700 text-gray-400 hover:bg-accent-danger/20 hover:text-accent-danger px-2 py-1.5 rounded-lg transition-colors ml-auto">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
          </button>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

function renderIdeasStats() {
  const container = document.getElementById('ideasStats');
  if (!container) return;

  const now = new Date();
  const STALLED_DAYS = 30;
  const total = ideas.length;
  const executed = ideas.filter(i => i.status === 'executed').length;
  const rejected = ideas.filter(i => i.status === 'rejected').length;
  const active = ideas.filter(i => !['executed', 'rejected'].includes(i.status)).length;
  const stalled = ideas.filter(i => {
    if (i.status === 'executed' || i.status === 'rejected') return false;
    const updated = new Date(i.updatedAt || i.createdAt);
    return (now - updated) / (1000 * 60 * 60 * 24) > STALLED_DAYS;
  }).length;
  const conversionRate = total > 0 ? ((executed / total) * 100).toFixed(1) : '0.0';
  const rejectionRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0.0';
  const totalPotential = ideas.filter(i => !['executed', 'rejected'].includes(i.status)).reduce((s, i) => s + (i.estimatedValue || 0), 0);

  container.innerHTML = `
    <div class="glass rounded-xl p-3 sm:p-4">
      <p class="text-gray-400 text-[10px] sm:text-xs mb-0.5">Total de Ideias</p>
      <p class="text-lg sm:text-2xl font-bold">${total}</p>
      <p class="text-[10px] text-gray-500">${active} ativa(s)</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-4">
      <p class="text-gray-400 text-[10px] sm:text-xs mb-0.5">Taxa de Conversão</p>
      <p class="text-lg sm:text-2xl font-bold text-accent-success">${conversionRate}%</p>
      <p class="text-[10px] text-gray-500">${executed} executada(s)</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-4">
      <p class="text-gray-400 text-[10px] sm:text-xs mb-0.5">Não Convertidas</p>
      <p class="text-lg sm:text-2xl font-bold text-accent-danger">${rejectionRate}%</p>
      <p class="text-[10px] text-gray-500">${rejected} descartada(s)</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-4">
      <p class="text-gray-400 text-[10px] sm:text-xs mb-0.5">Paradas (+30d)</p>
      <p class="text-lg sm:text-2xl font-bold text-accent-warning">${stalled}</p>
      <p class="text-[10px] text-gray-500">sem atualização</p>
    </div>
    <div class="glass rounded-xl p-3 sm:p-4">
      <p class="text-gray-400 text-[10px] sm:text-xs mb-0.5">Potencial Ativo</p>
      <p class="text-lg sm:text-2xl font-bold text-accent-primary">${formatCurrency(totalPotential)}</p>
      <p class="text-[10px] text-gray-500">em pipeline</p>
    </div>
  `;
}

// Initialize - define showSection first so onclick handlers work
window.showSection = showSection;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.saveClient = saveClient;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.saveProject = saveProject;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.saveTransaction = saveTransaction;
window.editSubscription = editSubscription;
window.deleteSubscription = deleteSubscription;
window.saveSubscription = saveSubscription;
window.editCost = editCost;
window.deleteCost = deleteCost;
window.saveCost = saveCost;
window.confirmDelete = confirmDelete;
window.generateReport = generateReport;
window.exportReport = exportReport;
window.filterTransactions = filterTransactions;
window.updateChartPeriod = updateChartPeriod;
window.openSchema = openSchema;
window.toggleSchemaEdit = toggleSchemaEdit;
window.saveSchema = saveSchema;
window.logout = logout;
window.kanbanDrop = kanbanDrop;
window.checkAllUptime = checkAllUptime;
window.openChangelog = openChangelog;
window.addChangelogEntry = addChangelogEntry;
window.deleteChangelogEntry = deleteChangelogEntry;
window.openProposalModal = openProposalModal;
window.addProposalItem = addProposalItem;
window.removeProposalItem = removeProposalItem;
window.updateProposalItem = updateProposalItem;
window.previewProposal = previewProposal;
window.backToProposalForm = backToProposalForm;
window.printProposal = printProposal;
window.saveProposal = saveProposal;
window.deleteProposal = deleteProposal;
window.toggleNotifications = toggleNotifications;
window.markAllNotificationsRead = markAllNotificationsRead;
window.clearAllNotifications = clearAllNotifications;
window.addServiceOption = addServiceOption;
window.removeServiceOption = removeServiceOption;
window.toggleProposalService = toggleProposalService;
window.updateProposalServiceQty = updateProposalServiceQty;
window.updateProposalServicePrice = updateProposalServicePrice;
window.openIdeaModal = openIdeaModal;
window.saveIdea = saveIdea;
window.deleteIdea = deleteIdea;
window.executeIdea = executeIdea;
window.filterIdeas = filterIdeas;

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  if (notificationsOpen && !e.target.closest('#notifPanel') && !e.target.closest('[onclick*="toggleNotifications"]')) {
    notificationsOpen = false;
    document.getElementById('notifPanel')?.classList.add('hidden');
  }
});

// Initialize app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
