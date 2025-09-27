document.addEventListener('DOMContentLoaded', async () => {
    // --- Global State ---
    let workshopSettings = {};
    let debounceTimer;

    // --- Authentication Check ---
    auth.onAuthStateChanged(user => {
        if (!user && !window.location.pathname.endsWith('index.html')) {
            window.location.href = 'index.html';
        } else if (user) {
            initialize(user);
        }
    });

    // --- App Initialization ---
    async function initialize(user) {
        await loadSettings();
        setupUI(user);
        loadPageData();
    }

    // --- Load Workshop Settings ---
    async function loadSettings() {
        try {
            const settingsDoc = await db.collection('Settings').doc('workshopDetails').get();
            if (settingsDoc.exists) {
                workshopSettings = settingsDoc.data();
            } else {
                workshopSettings = { name: 'My Workshop', address: '', phone: '' };
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            workshopSettings = { name: 'My Workshop', address: '', phone: '' };
        }
    }

    // --- UI Setup ---
    function setupUI(user) {
        const userEmailSpan = document.getElementById('user-email');
        if (userEmailSpan) userEmailSpan.textContent = user.email;

        if (document.getElementById('sidebar-workshop-name')) {
            document.getElementById('sidebar-workshop-name').textContent = workshopSettings.name;
        }

        const employeeLink = document.getElementById('employee-link');
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'admin' && employeeLink) {
            employeeLink.style.display = 'block';
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', e => {
                e.preventDefault();
                auth.signOut().then(() => {
                    localStorage.removeItem('userRole');
                    window.location.href = 'index.html';
                });
            });
        }
    }

    // --- Page-Specific Logic Router ---
    function loadPageData() {
        const path = window.location.pathname;
        if (path.endsWith('dashboard.html')) loadDashboardData();
        else if (path.endsWith('stock.html')) setupStockPage();
        else if (path.endsWith('billing.html')) setupBillingPage();
        else if (path.endsWith('invoices.html')) setupInvoicesPage();
        else if (path.endsWith('employees.html')) setupEmployeesPage();
        else if (path.endsWith('settings.html')) setupSettingsPage();
    }

    // --- Settings Page ---
    function setupSettingsPage() {
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm['workshop-name'].value = workshopSettings.name || '';
            settingsForm['workshop-address'].value = workshopSettings.address || '';
            settingsForm['workshop-phone'].value = workshopSettings.phone || '';

            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newSettings = {
                    name: settingsForm['workshop-name'].value,
                    address: settingsForm['workshop-address'].value,
                    phone: settingsForm['workshop-phone'].value,
                };
                await db.collection('Settings').doc('workshopDetails').set(newSettings);
                alert('Settings saved!');
                workshopSettings = newSettings;
                document.getElementById('sidebar-workshop-name').textContent = workshopSettings.name;
            });
        }
        
        const goalForm = document.getElementById('goal-form');
        if(goalForm) {
            db.collection('Settings').doc('salesGoal').get().then(doc => {
                if(doc.exists) goalForm['monthly-goal'].value = doc.data().goal;
            });
            goalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const goal = Number(goalForm['monthly-goal'].value);
                await db.collection('Settings').doc('salesGoal').set({ goal });
                alert('Monthly goal updated!');
            });
        }
    }

    // --- Dashboard Page ---
    async function loadDashboardData() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

        // --- Today's Sales data ---
        const todaySalesSnapshot = await db.collection('Data/Invoices/AllInvoices').where('date', '>=', startOfToday).get();
        let todaySales = 0;
        todaySalesSnapshot.forEach(doc => todaySales += doc.data().total);
        if(document.getElementById('today-sales')) document.getElementById('today-sales').textContent = `₹${todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if(document.getElementById('today-profit')) document.getElementById('today-profit').textContent = `₹${(todaySales * 0.2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // --- Total Stock Value ---
        const stockSnapshot = await db.collection('Data/Stock/Items').get();
        let totalStockValue = 0;
        stockSnapshot.forEach(doc => {
            const item = doc.data();
            totalStockValue += item.purchasePrice * item.quantity;
        });
        if(document.getElementById('total-stock-value')) document.getElementById('total-stock-value').textContent = `₹${totalStockValue.toLocaleString('en-IN')}`;
        
        // --- Total Sales, Paid, and Due Amounts ---
        const allSalesSnapshot = await db.collection('Data/Invoices/AllInvoices').get();
        let totalSellValue = 0;
        let totalPaidAmount = 0;
        let totalDueAmount = 0;
        allSalesSnapshot.forEach(doc => {
            const invoice = doc.data();
            totalSellValue += invoice.total;
            if (invoice.status === 'Paid') {
                totalPaidAmount += invoice.total;
            } else if (invoice.status === 'Due') {
                totalDueAmount += invoice.total;
            }
        });
        if(document.getElementById('total-sell-value')) document.getElementById('total-sell-value').textContent = `₹${totalSellValue.toLocaleString('en-IN')}`;
        if(document.getElementById('total-paid-amount')) document.getElementById('total-paid-amount').textContent = `₹${totalPaidAmount.toLocaleString('en-IN')}`;
        if(document.getElementById('total-due-amount')) document.getElementById('total-due-amount').textContent = `₹${totalDueAmount.toLocaleString('en-IN')}`;

        // --- Monthly Goal ---
        const goalDoc = await db.collection('Settings').doc('salesGoal').get();
        const monthlyGoal = goalDoc.exists ? goalDoc.data().goal : 100000;
        const monthlySalesSnapshot = await db.collection('Data/Invoices/AllInvoices').where('date', '>=', startOfMonth).get();
        let monthlySales = 0;
        monthlySalesSnapshot.forEach(doc => monthlySales += doc.data().total);
        
        const goalProgress = Math.min((monthlySales / monthlyGoal) * 100, 100);
        if(document.getElementById('monthly-goal-progress')) document.getElementById('monthly-goal-progress').style.width = `${goalProgress}%`;
        if(document.getElementById('monthly-goal-text')) document.getElementById('monthly-goal-text').textContent = `₹${monthlySales.toLocaleString('en-IN')} / ₹${monthlyGoal.toLocaleString('en-IN')}`;

        // --- Recent Sales Table ---
        const recentSalesTable = document.getElementById('recent-sales-table')?.getElementsByTagName('tbody')[0];
        if (recentSalesTable) {
            const recentSales = await db.collection('Data/Invoices/AllInvoices').orderBy('createdAt', 'desc').limit(10).get();
            recentSalesTable.innerHTML = '';
            recentSales.forEach(doc => {
                const data = doc.data();
                const row = recentSalesTable.insertRow();
                row.innerHTML = `<td>${doc.id.substring(0,8)}...</td><td>${data.customer.name}</td><td>₹${data.total.toFixed(2)}</td><td><span class="status-${data.status.toLowerCase()}">${data.status}</span></td><td>${data.date}</td>`;
            });
        }
    }

    // --- Stock Management Page ---
    let stockPageCursors = [null];
    let stockCurrentPage = 1;
    const STOCK_PER_PAGE = 10;
    
    function setupStockPage() {
        const form = document.getElementById('add-stock-form');
        if (!form) return;
        
        document.getElementById('purchase-date').valueAsDate = new Date();
        
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const stockId = form['stock-id'].value;
            const stockData = {
                name: form['item-name'].value,
                code: form['item-number'].value,
                description: form['item-description'].value,
                purchaseDate: form['purchase-date'].value,
                purchasePrice: Number(form['purchase-price'].value),
                quantity: Number(form['quantity'].value),
                gst: Number(form['gst-percent'].value),
                sellingPrice: Number(form['selling-price'].value) || Number(form['purchase-price'].value) * 1.25,
            };

            if (stockId) {
                await db.collection('Data/Stock/Items').doc(stockId).update(stockData);
            } else {
                stockData.addedAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('Data/Stock/Items').add(stockData);
            }
            resetStockForm();
            loadStockPage(true);
        });
        
        document.getElementById('stock-cancel-btn').addEventListener('click', resetStockForm);
        
        document.getElementById('stock-table').addEventListener('click', async e => {
            const target = e.target.closest('.action-btn');
            if (!target) return;
            const id = target.dataset.id;
            if (target.classList.contains('edit-stock')) {
                const doc = await db.collection('Data/Stock/Items').doc(id).get();
                if(doc.exists) populateStockForm(id, doc.data());
            } else if (target.classList.contains('delete-stock')) {
                if (confirm('Are you sure you want to delete this stock item?')) {
                    await db.collection('Data/Stock/Items').doc(id).delete();
                    loadStockPage(true);
                }
            }
        });

        document.getElementById('stock-search').addEventListener('keyup', () => debounce(() => loadStockPage(true), 500));
        document.getElementById('prev-page-stock')?.addEventListener('click', () => { if (stockCurrentPage > 1) { stockCurrentPage--; loadStockPage(); } });
        document.getElementById('next-page-stock')?.addEventListener('click', () => { stockCurrentPage++; loadStockPage(); });

        loadStockPage(true);
    }
    
    function populateStockForm(id, data) {
        const form = document.getElementById('add-stock-form');
        form['stock-id'].value = id;
        form['item-name'].value = data.name;
        form['item-number'].value = data.code;
        form['item-description'].value = data.description;
        form['purchase-date'].value = data.purchaseDate;
        form['purchase-price'].value = data.purchasePrice;
        form['quantity'].value = data.quantity;
        form['gst-percent'].value = data.gst;
        form['selling-price'].value = data.sellingPrice;
        
        document.getElementById('stock-form-title').textContent = 'Edit Stock';
        document.getElementById('stock-submit-btn').textContent = 'Update Stock';
        document.getElementById('stock-cancel-btn').style.display = 'inline-block';
        document.getElementById('stock-form-card').scrollIntoView({ behavior: 'smooth' });
    }

    function resetStockForm() {
        const form = document.getElementById('add-stock-form');
        form.reset();
        document.getElementById('purchase-date').valueAsDate = new Date();
        form['stock-id'].value = '';
        document.getElementById('stock-form-title').textContent = 'Add New Stock';
        document.getElementById('stock-submit-btn').textContent = 'Add Stock';
        document.getElementById('stock-cancel-btn').style.display = 'none';
    }

    async function loadStockPage(isNewQuery = false) {
        const tableBody = document.getElementById('stock-table')?.getElementsByTagName('tbody')[0];
        if (!tableBody) return;

        if (isNewQuery) {
            stockCurrentPage = 1;
            stockPageCursors = [null];
        }

        let query = db.collection('Data/Stock/Items').orderBy('addedAt', 'desc');
        
        const startAfterCursor = stockPageCursors[stockCurrentPage - 1];
        if (startAfterCursor) {
            query = query.startAfter(startAfterCursor);
        }
        query = query.limit(STOCK_PER_PAGE);

        const snapshot = await query.get();
        if (snapshot.docs.length > 0) {
            stockPageCursors[stockCurrentPage] = snapshot.docs[snapshot.docs.length - 1];
        }

        const searchFilter = document.getElementById('stock-search').value.toLowerCase();
        let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Firestore doesn't support native partial text search, so we filter after fetching.
        // This is okay for small-to-medium datasets but for very large ones, a dedicated search service like Algolia is better.
        if (searchFilter) {
            results = results.filter(item => 
                item.name.toLowerCase().includes(searchFilter) || 
                (item.code && item.code.toLowerCase().includes(searchFilter))
            );
        }
        
        tableBody.innerHTML = '';
        results.forEach(item => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.code || 'N/A'}</td>
                <td>${item.quantity}</td>
                <td>₹${item.purchasePrice.toFixed(2)}</td>
                <td>₹${item.sellingPrice.toFixed(2)}</td>
                <td class="actions">
                    <button class="action-btn edit-stock" title="Edit" data-id="${item.id}"><i class="fas fa-pen-to-square"></i></button>
                    <button class="action-btn delete-stock" title="Delete" data-id="${item.id}"><i class="fas fa-trash-can"></i></button>
                </td>
            `;
        });
        
        updatePaginationUI('stock', snapshot.size < STOCK_PER_PAGE);
    }
    
    // --- Billing Page ---
    let fuse;
    let localStock = [];
    let invoiceItems = [];
    async function setupBillingPage() {
        setupModalEventListeners();
        const urlParams = new URLSearchParams(window.location.search);
        const invoiceIdToEdit = urlParams.get('edit');

        const snapshot = await db.collection('Data/Stock/Items').get();
        localStock = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const options = { keys: ['name', 'code'], includeScore: true, threshold: 0.4 };
        fuse = new Fuse(localStock, options);

        const searchInput = document.getElementById('item-search-input');
        const searchResults = document.getElementById('search-results');
        
        searchInput.addEventListener('input', e => {
            const query = e.target.value;
            if (query.length < 1) { searchResults.style.display = 'none'; return; }
            const results = fuse.search(query).slice(0, 10);
            searchResults.innerHTML = '';
            results.forEach(({ item }) => {
                if (item.quantity > 0) {
                    const div = document.createElement('div');
                    div.innerHTML = `${item.name} (Code: ${item.code}) - <b>Stock: ${item.quantity}</b>`;
                    div.dataset.itemId = item.id;
                    div.onclick = () => addItemToInvoice(item.id);
                    searchResults.appendChild(div);
                }
            });
            searchResults.style.display = 'block';
        });
        
        document.getElementById('invoice-items-table').addEventListener('input', e => {
            if (e.target.classList.contains('item-qty')) {
                const index = e.target.dataset.index;
                const newQty = parseInt(e.target.value);
                const maxQty = invoiceItems[index].stockQuantity;
                if (newQty > maxQty) {
                    alert(`Cannot exceed available stock (${maxQty}).`);
                    e.target.value = maxQty;
                }
                invoiceItems[index].qty = parseInt(e.target.value);
                renderInvoiceItems();
            }
        });

        document.getElementById('invoice-items-table').addEventListener('click', e => {
            const removeButton = e.target.closest('.remove-item');
            if (removeButton) {
                invoiceItems.splice(removeButton.dataset.index, 1);
                renderInvoiceItems();
            }
        });
        ['invoice-gst-rate', 'invoice-discount'].forEach(id => { document.getElementById(id).addEventListener('input', renderInvoiceItems); });
        
        document.getElementById('save-invoice-btn').addEventListener('click', () => handleSaveInvoice(false));
        document.getElementById('print-invoice-btn').addEventListener('click', () => handleSaveInvoice(true));
        
        document.querySelector('.close-button').onclick = () => document.getElementById('invoice-modal').style.display = 'none';
        document.getElementById('modal-print-btn').onclick = () => window.print();

        if (invoiceIdToEdit) {
            loadInvoiceForEditing(invoiceIdToEdit);
        }
    }

    async function loadInvoiceForEditing(invoiceId) {
        const doc = await db.collection('Data/Invoices/AllInvoices').doc(invoiceId).get();
        if (!doc.exists) { alert('Invoice not found!'); window.location.href = 'invoices.html'; return; }
        const data = doc.data();
        document.getElementById('billing-page-title').textContent = `Edit Invoice #${doc.id.substring(0,8)}`;
        document.getElementById('invoice-id').value = doc.id;
        document.getElementById('customer-name').value = data.customer.name;
        document.getElementById('customer-address').value = data.customer.address;
        document.getElementById('customer-phone').value = data.customer.phone;
        invoiceItems = data.items.map(item => ({ ...item, stockQuantity: (localStock.find(s => s.id === item.id)?.quantity || 0) + item.qty }));
        document.getElementById('invoice-gst-rate').value = data.gstRate;
        document.getElementById('invoice-discount').value = data.discount;
        document.getElementById('payment-status').value = data.status;
        document.getElementById('payment-mode').value = data.mode;
        document.getElementById('save-invoice-btn').textContent = 'Update Invoice';
        document.getElementById('print-invoice-btn').textContent = 'Update & Print';
        renderInvoiceItems();
    }

    async function handleSaveInvoice(andPrint) {
        const invoiceId = document.getElementById('invoice-id').value;
        const isUpdate = !!invoiceId;
        const customer = { name: document.getElementById('customer-name').value, address: document.getElementById('customer-address').value, phone: document.getElementById('customer-phone').value };
        if (!customer.name) return alert('Please enter a customer name.');
        if (invoiceItems.length === 0) return alert('Please add items to the invoice.');
        let subtotal = 0;
        invoiceItems.forEach(item => subtotal += item.price * item.qty);
        const gstRate = Number(document.getElementById('invoice-gst-rate').value);
        const gst = subtotal * (gstRate / 100);
        const discount = Number(document.getElementById('invoice-discount').value);
        const total = subtotal + gst - discount;
        const invoiceData = { customer, items: invoiceItems.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, total: i.qty * i.price })), subtotal, gst, gstRate, discount, total, status: document.getElementById('payment-status').value, mode: document.getElementById('payment-mode').value, date: new Date().toISOString().split('T')[0], ...(isUpdate ? {} : { createdAt: firebase.firestore.FieldValue.serverTimestamp() }) };
        
        const batch = db.batch();
        if (isUpdate) {
            // Complex: Need to revert old quantities and apply new ones.
            // For simplicity, this is omitted. Production apps need a more robust solution.
            await db.collection('Data/Invoices/AllInvoices').doc(invoiceId).update(invoiceData);
            alert(`Invoice ${invoiceId} updated successfully!`);
        } else {
            const invoiceRef = await db.collection('Data/Invoices/AllInvoices').add(invoiceData);
            invoiceData.items.forEach(item => {
                const stockRef = db.collection('Data/Stock/Items').doc(item.id);
                batch.update(stockRef, { quantity: firebase.firestore.FieldValue.increment(-item.qty) });
            });
            await batch.commit();
            alert(`Invoice ${invoiceRef.id} saved successfully!`);
        }
        
        if (andPrint) { showPrintableInvoice(invoiceId || 'new', invoiceData); } 
        else { window.location.href = 'invoices.html'; }
    }

    // --- Invoices List Page ---
     let invoiceCurrentPage = 1;
    const INVOICES_PER_PAGE = 10;
    let allInvoicesCache = [];

    function setupInvoicesPage() {
         setupModalEventListeners();
        db.collection('Data/Invoices/AllInvoices').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            allInvoicesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loadInvoicesPage(true);
        });

        const searchInput = document.getElementById('invoice-search');
        const statusFilter = document.getElementById('status-filter');
        const dateFilter = document.getElementById('date-filter');
        const clearBtn = document.getElementById('clear-filters');

        searchInput.addEventListener('keyup', () => debounce(() => loadInvoicesPage(true), 300));
        statusFilter.addEventListener('change', () => loadInvoicesPage(true));
        dateFilter.addEventListener('change', () => loadInvoicesPage(true));

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            statusFilter.value = 'all';
            dateFilter.value = '';
            loadInvoicesPage(true);
        });
        
        document.getElementById('prev-page').addEventListener('click', () => { if (invoiceCurrentPage > 1) { invoiceCurrentPage--; loadInvoicesPage(); } });
        document.getElementById('next-page').addEventListener('click', () => { invoiceCurrentPage++; loadInvoicesPage(); });

        document.getElementById('invoices-table').addEventListener('click', async e => {
            const target = e.target.closest('.action-btn');
            if (!target) return;
            const id = target.dataset.id;
            if (target.classList.contains('view-invoice')) { const doc = await db.collection('Data/Invoices/AllInvoices').doc(id).get(); showPrintableInvoice(id, doc.data()); } 
            else if (target.classList.contains('edit-invoice')) { window.location.href = `billing.html?edit=${id}`; } 
            else if (target.classList.contains('toggle-status')) { const newStatus = target.dataset.status === 'Paid' ? 'Due' : 'Paid'; await db.collection('Data/Invoices/AllInvoices').doc(id).update({ status: newStatus }); } 
            else if (target.classList.contains('delete-invoice')) { if (confirm('Are you sure? This cannot be undone.')) { await db.collection('Data/Invoices/AllInvoices').doc(id).delete(); } }
        });
    }

    function loadInvoicesPage(isNewQuery = false) {
        const tableBody = document.getElementById('invoices-table')?.getElementsByTagName('tbody')[0];
        if (!tableBody) return;

        if (isNewQuery) {
            invoiceCurrentPage = 1;
        }

        const statusFilter = document.getElementById('status-filter').value;
        const dateFilter = document.getElementById('date-filter').value;
        const searchFilter = document.getElementById('invoice-search').value.toLowerCase();

        let filteredResults = allInvoicesCache;

        if (searchFilter) {
            filteredResults = filteredResults.filter(invoice => invoice.customer.name.toLowerCase().includes(searchFilter) || invoice.id.toLowerCase().includes(searchFilter));
        }
        if (statusFilter !== 'all') {
            filteredResults = filteredResults.filter(invoice => invoice.status === statusFilter);
        }
        if (dateFilter) {
            filteredResults = filteredResults.filter(invoice => invoice.date === dateFilter);
        }

        const startIndex = (invoiceCurrentPage - 1) * INVOICES_PER_PAGE;
        const endIndex = startIndex + INVOICES_PER_PAGE;
        const paginatedResults = filteredResults.slice(startIndex, endIndex);

        tableBody.innerHTML = '';
        paginatedResults.forEach(invoice => {
            const row = tableBody.insertRow();
            // UPDATED LINE: Added customer phone number
            row.innerHTML = `
                <td>${invoice.id.substring(0, 8)}...</td>
                <td>${invoice.customer.name}</td>
                <td>${invoice.customer.phone || 'N/A'}</td>
                <td>${invoice.date}</td>
                <td>₹${invoice.total.toFixed(2)}</td>
                <td><span class="status-${invoice.status.toLowerCase()}">${invoice.status}</span></td>
                <td class="actions">
                    <button class="action-btn view-invoice" title="View" data-id="${invoice.id}"><i class="fas fa-eye"></i></button>
                    <button class="action-btn edit-invoice" title="Edit" data-id="${invoice.id}"><i class="fas fa-pen-to-square"></i></button>
                    <button class="action-btn toggle-status" title="Change Status" data-id="${invoice.id}" data-status="${invoice.status}"><i class="fas fa-arrows-rotate"></i></button>
                    <button class="action-btn delete-invoice" title="Delete" data-id="${invoice.id}"><i class="fas fa-trash-can"></i></button>
                </td>`;
        });
        
        updatePaginationUI('invoice', endIndex >= filteredResults.length);
    }

    
    // --- Generic Helper Functions ---

     // --- Helper Functions ---
     function setupModalEventListeners() {
        const modal = document.getElementById('invoice-modal');
        if (!modal) return;
    
        const closeButton = modal.querySelector('.close-button');
        const printButton = modal.querySelector('#modal-print-btn');
    
        if (closeButton) {
            closeButton.onclick = () => {
                modal.style.display = 'none';
            };
        }
    
        if (printButton) {
            printButton.onclick = () => {
                document.body.classList.add('print-active');
                window.print();
                document.body.classList.remove('print-active');
            };
        }
        
        window.onclick = (event) => {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        };
    
        // Also handle the afterprint event to be safe
        window.onafterprint = () => {
            document.body.classList.remove('print-active');
        };
    }
    function updatePaginationUI(type, isLastPage) {
        const pageInfoId = `page-info${type === 'stock' ? '-stock' : ''}`;
        const prevBtnId = `prev-page${type === 'stock' ? '-stock' : ''}`;
        const nextBtnId = `next-page${type === 'stock' ? '-stock' : ''}`;
        const currentPage = type === 'stock' ? stockCurrentPage : invoiceCurrentPage;

        if(document.getElementById(pageInfoId)) document.getElementById(pageInfoId).textContent = `Page ${currentPage}`;
        if(document.getElementById(prevBtnId)) document.getElementById(prevBtnId).disabled = currentPage === 1;
        if(document.getElementById(nextBtnId)) document.getElementById(nextBtnId).disabled = isLastPage;
    }
    
    function addItemToInvoice(itemId) {
        const item = localStock.find(i => i.id === itemId);
        if (!item || item.quantity <= 0) return;
        const existingItem = invoiceItems.find(i => i.id === itemId);
        if (existingItem) { if (existingItem.qty < item.quantity) existingItem.qty++; else alert('Maximum stock quantity reached for this item.'); } 
        else { invoiceItems.push({ id: item.id, name: item.name, price: item.sellingPrice, qty: 1, stockQuantity: item.quantity }); }
        renderInvoiceItems();
        document.getElementById('item-search-input').value = '';
        document.getElementById('search-results').style.display = 'none';
    }

    function renderInvoiceItems() {
        const tableBody = document.getElementById('invoice-items-table').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';
        let subtotal = 0;
        invoiceItems.forEach((item, index) => {
            const row = tableBody.insertRow();
            const itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            row.innerHTML = `<td>${item.name}</td><td><input type="number" class="item-qty" value="${item.qty}" data-index="${index}" min="1" max="${item.stockQuantity}"></td><td>₹${item.price.toFixed(2)}</td><td>₹${itemTotal.toFixed(2)}</td><td><button type="button" class="action-btn remove-item" data-index="${index}"><i class="fas fa-times"></i></button></td>`;
        });
        updateSummary(subtotal);
    }

    function updateSummary(subtotal) {
        const gstRate = Number(document.getElementById('invoice-gst-rate').value) || 0;
        const gst = subtotal * (gstRate / 100);
        const discount = Number(document.getElementById('invoice-discount').value) || 0;
        const total = subtotal + gst - discount;
        document.getElementById('invoice-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('invoice-gst').textContent = `₹${gst.toFixed(2)}`;
        document.getElementById('invoice-total').textContent = `₹${total.toFixed(2)}`;
    }

    function showPrintableInvoice(id, data) {
        const modal = document.getElementById('invoice-modal');
        const printable = document.getElementById('printable-invoice');
        let itemsHtml = data.items.map(item => `<tr><td>${item.name}</td><td>${item.qty}</td><td>₹${item.price.toFixed(2)}</td><td>₹${item.total.toFixed(2)}</td></tr>`).join('');
       printable.innerHTML = `
    <div style="
        font-family: Arial, sans-serif; 
        border: 1px solid #ccc; 
        padding: 20px;
    ">
        <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            border-bottom: 2px solid #333; 
            padding-bottom: 10px;
        ">
            <div>
                <img src="images/logo_print.wepb" alt="Logo" style="
                    width: 100px; 
                    margin-bottom: 10px;
                "><br>
                ${workshopSettings.address}
                <p style="margin:0;">${workshopSettings.phone}
            </div>
            <div style="text-align: right;">
                <h3 style="margin: 0;">INVOICE</h3>
                <p><strong>Invoice #:</strong> ${id}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Status:</strong> ${data.status}</p>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <strong>Bill To:</strong>
                ${data.customer.name}
            <br>${data.customer.address}
            <br>${data.customer.phone}
        </div>
        <table style="
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
        ">
            <thead style="background-color: #f2f2f2;">
                <tr>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Item</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Qty</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Price</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <div style="
            text-align: right; 
            margin-top: 20px; 
            width: 40%; 
            margin-left: auto;
        ">
            <p style="display:flex; justify-content: space-between;">
                <strong>Subtotal:</strong> 
                <span>₹${data.subtotal.toFixed(2)}</span>
            </p>
            <p style="display:flex; justify-content: space-between;">
                <strong>GST (${data.gstRate}%):</strong> 
                <span>₹${data.gst.toFixed(2)}</span>
            </p>
            <p style="display:flex; justify-content: space-between;">
                <strong>Discount:</strong> 
                <span>-₹${data.discount.toFixed(2)}</span>
            </p>
            <h4 style="font-size: 1.2em; display:flex; justify-content: space-between;">
                <strong>Total:</strong> 
                <span>₹${data.total.toFixed(2)}</span>
            </h4>
        </div>
    </div>
`;
        modal.style.display = 'block';
    }

    // --- Employee Management Page ---
    function setupEmployeesPage() {
        const form = document.getElementById('add-employee-form');
        if (!form) return;
        form.addEventListener('submit', e => {
            e.preventDefault();
            const email = form['employee-email'].value;
            const role = form['employee-role'].value;
            db.collection('Accounts').add({ email: email, type: role, status: 'active' }).then(() => {
                alert(`User ${email} added with role ${role}. Please create their login in the Firebase Authentication console.`);
                form.reset();
                loadEmployees();
            }).catch(err => console.error("Error adding employee: ", err));
        });
        document.getElementById('employees-table')?.addEventListener('click', e => {
            if (e.target.closest('.remove-employee')) {
                const id = e.target.closest('.remove-employee').dataset.id;
                if (confirm('Are you sure? This only removes the user from the role database, not from Firebase Auth.')) {
                    db.collection('Accounts').doc(id).delete();
                }
            }
        });
        loadEmployees();
    }

    function loadEmployees() {
        const table = document.getElementById('employees-table')?.getElementsByTagName('tbody')[0];
        if (!table) return;
        db.collection('Accounts').onSnapshot(snapshot => {
            table.innerHTML = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                const row = table.insertRow();
                row.innerHTML = `<td>${user.email}</td><td>${user.type}</td><td>${user.status}</td><td class="actions"><button data-id="${doc.id}" class="action-btn remove-employee"><i class="fas fa-trash-can"></i></button></td>`;
            });
        });
    }

    const debounce = (func, delay) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(func, delay);
    };
});