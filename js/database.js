/* ============================================================
   Property Management App — Database Layer (localStorage)
   ============================================================ */

const DB = {
  VERSION: 'pma_v1',

  init() {
    if (!localStorage.getItem(this.VERSION + '_initialized')) {
      this._seed();
      localStorage.setItem(this.VERSION + '_initialized', 'true');
    }
    this._migrateTenantNumbers();
  },

  _migrateTenantNumbers() {
    const tenants = this.getAll('tenants');
    let changed = false;
    const updated = tenants.map(t => {
      if (t.TenantNumber && /^TN-\d{4}-/.test(t.TenantNumber)) {
        changed = true;
        return { ...t, TenantNumber: t.TenantNumber.replace(/^TN-\d{4}-/, 'TN-') };
      }
      return t;
    });
    if (changed) this.save('tenants', updated);
  },

  reset() {
    localStorage.removeItem(this.VERSION + '_initialized');
    ['agencies','clients','properties','propunits','tenants','transactions'].forEach(t =>
      localStorage.removeItem(this.VERSION + '_' + t));
    this.init();
  },

  // ── CRUD ──────────────────────────────────────────────────
  getAll(table) {
    return JSON.parse(localStorage.getItem(this.VERSION + '_' + table) || '[]');
  },
  save(table, data) {
    localStorage.setItem(this.VERSION + '_' + table, JSON.stringify(data));
  },
  find(table, filters) {
    return this.getAll(table).filter(r =>
      Object.entries(filters).every(([k, v]) => r[k] === v));
  },
  findOne(table, filters) {
    return this.find(table, filters)[0] || null;
  },
  insert(table, record) {
    const data = this.getAll(table);
    data.push(record);
    this.save(table, data);
    return record;
  },
  update(table, keyField, keyValue, updates) {
    const data = this.getAll(table);
    const idx = data.findIndex(r => r[keyField] === keyValue);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...updates };
    this.save(table, data);
    return true;
  },
  remove(table, keyField, keyValue) {
    const data = this.getAll(table).filter(r => r[keyField] !== keyValue);
    this.save(table, data);
  },
  nextCode(table, keyField, prefix, pad = 3) {
    const existing = this.getAll(table).map(r => r[keyField]).filter(c => c && c.startsWith(prefix));
    if (!existing.length) return prefix + '001';
    const nums = existing.map(c => parseInt(c.replace(prefix, '')) || 0);
    return prefix + String(Math.max(...nums) + 1).padStart(pad, '0');
  },
  nextTxRef() {
    const all = this.getAll('transactions');
    return 'TXN-' + String(all.length + 1).padStart(5, '0');
  },

  // ── SEED DATA ─────────────────────────────────────────────
  _seed() {
    /* ---- Agencies ---- */
    this.save('agencies', [
      { AgencyCode:'AG001', AgencyName:'Prime Realty Agency',     Address:'123 Main Street, New York, NY 10001',       Telephone:'(212) 555-0100', Email:'admin@primerealty.com',   Active:'Y', Master:'Y', UserName:'master',  Password:'master123',  UpdateUser:'System' },
      { AgencyCode:'AG002', AgencyName:'City Properties Ltd',     Address:'456 Oak Avenue, Chicago, IL 60601',         Telephone:'(312) 555-0200', Email:'info@cityprops.com',       Active:'Y', Master:'N', UserName:'agency1',  Password:'agency123',  UpdateUser:'System' },
      { AgencyCode:'AG003', AgencyName:'Metro Real Estate Group', Address:'789 Sunset Blvd, Los Angeles, CA 90001',    Telephone:'(310) 555-0300', Email:'contact@metrore.com',      Active:'Y', Master:'N', UserName:'agency2',  Password:'agency456',  UpdateUser:'System' }
    ]);

    /* ---- Clients ---- */
    this.save('clients', [
      { ClientCode:'CL001', AgencyCode:'AG001', ClientName:'John Smith Holdings LLC',    Address:'789 Pine Road, New York, NY 10002',          Telephone:'(212) 555-1001', Email:'john@smithholdings.com',  Date:'2024-01-15', Active:'Y', UserName:'client1', Password:'client123' },
      { ClientCode:'CL002', AgencyCode:'AG001', ClientName:'Maria Rodriguez Properties', Address:'321 Elm Street, Brooklyn, NY 11201',          Telephone:'(718) 555-1002', Email:'maria@rodriguez.com',      Date:'2024-02-20', Active:'Y', UserName:'client2', Password:'client456' },
      { ClientCode:'CL003', AgencyCode:'AG002', ClientName:'Thompson Real Estate Group', Address:'654 Maple Drive, Chicago, IL 60602',          Telephone:'(312) 555-1003', Email:'info@thompson.com',         Date:'2024-03-10', Active:'Y', UserName:'client3', Password:'client789' },
      { ClientCode:'CL004', AgencyCode:'AG002', ClientName:'Pacific Properties Inc',     Address:'987 Michigan Ave, Chicago, IL 60603',         Telephone:'(312) 555-1004', Email:'info@pacificprop.com',      Date:'2024-04-05', Active:'Y', UserName:'client4', Password:'client321' },
      { ClientCode:'CL005', AgencyCode:'AG003', ClientName:'Sunrise Investments Corp',   Address:'246 Pacific Coast Hwy, Los Angeles, CA 90002',Telephone:'(310) 555-1005', Email:'invest@sunrise.com',        Date:'2024-05-12', Active:'Y', UserName:'client5', Password:'client654' }
    ]);

    /* ---- Properties ---- */
    this.save('properties', [
      { PropertyCode:'PR001', PropertyName:'Sunset Apartments',    Country:'USA', City:'New York',    PropertyLocation:'100 Sunset Blvd, Manhattan, NY 10001',        PropertyType:'Apartment',   ClientCode:'CL001', Manager:'James Wilson',   ManagerPhone:'(212) 555-2001', Date:'2024-01-20', Note:'Modern luxury complex, doorman building',           AgencyCode:'AG001', PropertyPicture:'', UpdateUser:'System', Utilities:'Y', Water:'150', Electric:'200', Gas:'80',  Cable:'60',  Currency:'USD', Active:'Y' },
      { PropertyCode:'PR002', PropertyName:'Oak Tree Villas',      Country:'USA', City:'New York',    PropertyLocation:'200 Oak Lane, Queens, NY 11001',             PropertyType:'Villa',        ClientCode:'CL001', Manager:'Sarah Johnson',  ManagerPhone:'(212) 555-2002', Date:'2024-01-25', Note:'Exclusive gated villas with private gardens',           AgencyCode:'AG001', PropertyPicture:'', UpdateUser:'System', Utilities:'Y', Water:'120', Electric:'180', Gas:'75',  Cable:'50',  Currency:'USD', Active:'Y' },
      { PropertyCode:'PR003', PropertyName:'Downtown Lofts',       Country:'USA', City:'Chicago',     PropertyLocation:'300 W Adams St, Chicago, IL 60606',          PropertyType:'Loft',         ClientCode:'CL002', Manager:'Michael Brown',  ManagerPhone:'(312) 555-2003', Date:'2024-02-28', Note:'Urban industrial-style loft spaces',                     AgencyCode:'AG001', PropertyPicture:'', UpdateUser:'System', Utilities:'N', Water:'0',   Electric:'160', Gas:'0',   Cable:'40',  Currency:'USD', Active:'Y' },
      { PropertyCode:'PR004', PropertyName:'Lakeview Condos',      Country:'USA', City:'Chicago',     PropertyLocation:'400 N Lake Shore Dr, Chicago, IL 60611',     PropertyType:'Condo',        ClientCode:'CL003', Manager:'Emily Davis',    ManagerPhone:'(312) 555-2004', Date:'2024-03-15', Note:'Stunning lake views, concierge services',               AgencyCode:'AG002', PropertyPicture:'', UpdateUser:'System', Utilities:'Y', Water:'130', Electric:'190', Gas:'85',  Cable:'55',  Currency:'USD', Active:'Y' },
      { PropertyCode:'PR005', PropertyName:'Harbor View Flats',    Country:'USA', City:'Miami',       PropertyLocation:'500 Brickell Ave, Miami, FL 33131',          PropertyType:'Apartment',    ClientCode:'CL004', Manager:'Robert Garcia',  ManagerPhone:'(305) 555-2005', Date:'2024-04-20', Note:'Waterfront apartments, resort-style amenities',          AgencyCode:'AG002', PropertyPicture:'', UpdateUser:'System', Utilities:'Y', Water:'110', Electric:'170', Gas:'0',   Cable:'65',  Currency:'USD', Active:'Y' },
      { PropertyCode:'PR006', PropertyName:'Pacific Heights Suites',Country:'USA', City:'Los Angeles', PropertyLocation:'600 Wilshire Blvd, Los Angeles, CA 90017',   PropertyType:'Suite',        ClientCode:'CL005', Manager:'Jennifer Lee',   ManagerPhone:'(310) 555-2006', Date:'2024-05-15', Note:'Premium suites near downtown LA',                        AgencyCode:'AG003', PropertyPicture:'', UpdateUser:'System', Utilities:'Y', Water:'140', Electric:'210', Gas:'70',  Cable:'45',  Currency:'USD', Active:'Y' }
    ]);

    /* ---- Property Units ---- */
    this.save('propunits', [
      { UnitCode:'UN001', PropertyCode:'PR001', UnitNumber:'101', RentAmount:1500, DepositAmount:3000, UnitStatus:'Occupied', Date:'2024-01-20', Note:'2BR corner unit, city views',        Bedrooms:2, Bathrooms:1, Floor:1,  Active:'Y' },
      { UnitCode:'UN002', PropertyCode:'PR001', UnitNumber:'102', RentAmount:1600, DepositAmount:3200, UnitStatus:'Vacant',   Date:'2024-01-20', Note:'2BR upgraded kitchen & bath',        Bedrooms:2, Bathrooms:2, Floor:1,  Active:'Y' },
      { UnitCode:'UN003', PropertyCode:'PR001', UnitNumber:'201', RentAmount:1800, DepositAmount:3600, UnitStatus:'Occupied', Date:'2024-01-20', Note:'2BR deluxe, balcony',                 Bedrooms:2, Bathrooms:2, Floor:2,  Active:'Y' },
      { UnitCode:'UN004', PropertyCode:'PR002', UnitNumber:'V-01',RentAmount:2500, DepositAmount:5000, UnitStatus:'Occupied', Date:'2024-01-25', Note:'3BR villa, private pool',             Bedrooms:3, Bathrooms:2, Floor:1,  Active:'Y' },
      { UnitCode:'UN005', PropertyCode:'PR002', UnitNumber:'V-02',RentAmount:2800, DepositAmount:5600, UnitStatus:'Vacant',   Date:'2024-01-25', Note:'4BR villa, private pool & garden',   Bedrooms:4, Bathrooms:3, Floor:1,  Active:'Y' },
      { UnitCode:'UN006', PropertyCode:'PR003', UnitNumber:'L-301',RentAmount:2000,DepositAmount:4000, UnitStatus:'Occupied', Date:'2024-02-28', Note:'Studio loft, open plan',              Bedrooms:1, Bathrooms:1, Floor:3,  Active:'Y' },
      { UnitCode:'UN007', PropertyCode:'PR003', UnitNumber:'L-302',RentAmount:2200,DepositAmount:4400, UnitStatus:'Occupied', Date:'2024-02-28', Note:'1BR loft, exposed brick',             Bedrooms:1, Bathrooms:1, Floor:3,  Active:'Y' },
      { UnitCode:'UN008', PropertyCode:'PR004', UnitNumber:'401', RentAmount:1800, DepositAmount:3600, UnitStatus:'Occupied', Date:'2024-03-15', Note:'2BR condo, lake view',                Bedrooms:2, Bathrooms:2, Floor:4,  Active:'Y' },
      { UnitCode:'UN009', PropertyCode:'PR005', UnitNumber:'501', RentAmount:1900, DepositAmount:3800, UnitStatus:'Occupied', Date:'2024-04-20', Note:'2BR harbor view flat',                Bedrooms:2, Bathrooms:2, Floor:5,  Active:'Y' },
      { UnitCode:'UN010', PropertyCode:'PR006', UnitNumber:'601', RentAmount:2200, DepositAmount:4400, UnitStatus:'Occupied', Date:'2024-05-15', Note:'1BR premium suite, city view',        Bedrooms:1, Bathrooms:1, Floor:6,  Active:'Y' }
    ]);

    /* ---- Tenants ---- */
    this.save('tenants', [
      { TenantID:'T001', TenantNumber:'TN-001', PropertyCode:'PR001', UnitCode:'UN001', FirstName:'Alice',   LastName:'Cooper',    IDNumber:'ID-112233', Address:'100 Sunset Blvd #101, NY 10001',   Telephone:'(212) 555-3001', Email:'alice.cooper@email.com',   Photograph:'', RentAmount:1500, RentFrequency:'Monthly', DepositAmount:3000, MoveInDate:'2024-02-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant1', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T002', TenantNumber:'TN-002', PropertyCode:'PR002', UnitCode:'UN004', FirstName:'Bob',     LastName:'Martinez',  IDNumber:'ID-223344', Address:'200 Oak Lane V-01, Queens, NY',    Telephone:'(718) 555-3002', Email:'bob.martinez@email.com',   Photograph:'', RentAmount:2500, RentFrequency:'Monthly', DepositAmount:5000, MoveInDate:'2024-03-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant2', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T003', TenantNumber:'TN-003', PropertyCode:'PR003', UnitCode:'UN006', FirstName:'Carol',   LastName:'Williams',  IDNumber:'ID-334455', Address:'300 W Adams St L-301, Chicago',    Telephone:'(312) 555-3003', Email:'carol.williams@email.com', Photograph:'', RentAmount:2000, RentFrequency:'Monthly', DepositAmount:4000, MoveInDate:'2024-04-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant3', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T004', TenantNumber:'TN-004', PropertyCode:'PR004', UnitCode:'UN008', FirstName:'David',   LastName:'Johnson',   IDNumber:'ID-445566', Address:'400 N Lake Shore Dr #401, Chicago', Telephone:'(312) 555-3004', Email:'david.johnson@email.com',  Photograph:'', RentAmount:1800, RentFrequency:'Monthly', DepositAmount:3600, MoveInDate:'2024-05-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant4', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T005', TenantNumber:'TN-005', PropertyCode:'PR005', UnitCode:'UN009', FirstName:'Emma',    LastName:'Davis',     IDNumber:'ID-556677', Address:'500 Brickell Ave #501, Miami',      Telephone:'(305) 555-3005', Email:'emma.davis@email.com',     Photograph:'', RentAmount:1900, RentFrequency:'Monthly', DepositAmount:3800, MoveInDate:'2024-06-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant5', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T006', TenantNumber:'TN-006', PropertyCode:'PR006', UnitCode:'UN010', FirstName:'Frank',   LastName:'Wilson',    IDNumber:'ID-667788', Address:'600 Wilshire Blvd #601, LA',        Telephone:'(310) 555-3006', Email:'frank.wilson@email.com',   Photograph:'', RentAmount:2200, RentFrequency:'Monthly', DepositAmount:4400, MoveInDate:'2024-07-01', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant6', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T007', TenantNumber:'TN-007', PropertyCode:'PR001', UnitCode:'UN003', FirstName:'Grace',   LastName:'Lee',       IDNumber:'ID-778899', Address:'100 Sunset Blvd #201, NY 10001',   Telephone:'(212) 555-3007', Email:'grace.lee@email.com',      Photograph:'', RentAmount:1800, RentFrequency:'Monthly', DepositAmount:3600, MoveInDate:'2024-03-15', MoveOutDate:'', IDCopy:'',    RentAgreement:'', Active:'Y', UserName:'tenant7', Password:'tenant123', UpdateUser:'System' },
      { TenantID:'T008', TenantNumber:'TN-008', PropertyCode:'PR003', UnitCode:'UN007', FirstName:'Henry',   LastName:'Brown',     IDNumber:'ID-889900', Address:'300 W Adams St L-302, Chicago',    Telephone:'(312) 555-3008', Email:'henry.brown@email.com',    Photograph:'', RentAmount:2200, RentFrequency:'Monthly', DepositAmount:4400, MoveInDate:'2024-04-15', MoveOutDate:'2025-01-31', IDCopy:'', RentAgreement:'', Active:'N', UserName:'tenant8', Password:'tenant123', UpdateUser:'System' }
    ]);

    /* ---- Transactions ---- */
    this.save('transactions', [
      // T001 — Alice Cooper (PR001/UN001) rent=$1500
      { Date:'2024-02-01', TenantID:'T001', Authenticated:'Y', PropertyCode:'PR001', Description:'Security Deposit',        Amount: 3000, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00001' },
      { Date:'2024-02-01', TenantID:'T001', Authenticated:'Y', PropertyCode:'PR001', Description:'February Rent Payment',   Amount: 1500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00002' },
      { Date:'2024-03-01', TenantID:'T001', Authenticated:'Y', PropertyCode:'PR001', Description:'March Rent Payment',      Amount: 1500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00003' },
      { Date:'2024-04-01', TenantID:'T001', Authenticated:'Y', PropertyCode:'PR001', Description:'April Rent Payment',      Amount: 1500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00004' },
      { Date:'2024-04-15', TenantID:'T001', Authenticated:'N', PropertyCode:'PR001', Description:'Maintenance Charge',      Amount:-250,  Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00005' },
      { Date:'2024-05-01', TenantID:'T001', Authenticated:'Y', PropertyCode:'PR001', Description:'May Rent Payment',        Amount: 1500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00006' },

      // T002 — Bob Martinez (PR002/UN004) rent=$2500
      { Date:'2024-03-01', TenantID:'T002', Authenticated:'Y', PropertyCode:'PR002', Description:'Security Deposit',        Amount: 5000, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00007' },
      { Date:'2024-03-01', TenantID:'T002', Authenticated:'Y', PropertyCode:'PR002', Description:'March Rent Payment',      Amount: 2500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00008' },
      { Date:'2024-04-01', TenantID:'T002', Authenticated:'Y', PropertyCode:'PR002', Description:'April Rent Payment',      Amount: 2500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00009' },
      { Date:'2024-05-01', TenantID:'T002', Authenticated:'Y', PropertyCode:'PR002', Description:'May Rent Payment',        Amount: 2500, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00010' },

      // T003 — Carol Williams (PR003/UN006) rent=$2000
      { Date:'2024-04-01', TenantID:'T003', Authenticated:'Y', PropertyCode:'PR003', Description:'Security Deposit',        Amount: 4000, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00011' },
      { Date:'2024-04-01', TenantID:'T003', Authenticated:'Y', PropertyCode:'PR003', Description:'April Rent Payment',      Amount: 2000, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00012' },
      { Date:'2024-05-01', TenantID:'T003', Authenticated:'Y', PropertyCode:'PR003', Description:'May Rent Payment',        Amount: 2000, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00013' },

      // T004 — David Johnson (PR004/UN008) rent=$1800
      { Date:'2024-05-01', TenantID:'T004', Authenticated:'Y', PropertyCode:'PR004', Description:'Security Deposit',        Amount: 3600, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00014' },
      { Date:'2024-05-01', TenantID:'T004', Authenticated:'Y', PropertyCode:'PR004', Description:'May Rent Payment',        Amount: 1800, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00015' },
      { Date:'2024-06-01', TenantID:'T004', Authenticated:'Y', PropertyCode:'PR004', Description:'June Rent Payment',       Amount: 1800, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00016' },

      // T005 — Emma Davis (PR005/UN009) rent=$1900
      { Date:'2024-06-01', TenantID:'T005', Authenticated:'Y', PropertyCode:'PR005', Description:'Security Deposit',        Amount: 3800, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00017' },
      { Date:'2024-06-01', TenantID:'T005', Authenticated:'Y', PropertyCode:'PR005', Description:'June Rent Payment',       Amount: 1900, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00018' },
      { Date:'2024-06-20', TenantID:'T005', Authenticated:'N', PropertyCode:'PR005', Description:'Late Fee',                Amount:-100,  Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00019' },

      // T006 — Frank Wilson (PR006/UN010) rent=$2200
      { Date:'2024-07-01', TenantID:'T006', Authenticated:'Y', PropertyCode:'PR006', Description:'Security Deposit',        Amount: 4400, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00020' },
      { Date:'2024-07-01', TenantID:'T006', Authenticated:'Y', PropertyCode:'PR006', Description:'July Rent Payment',       Amount: 2200, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00021' },
      { Date:'2024-08-01', TenantID:'T006', Authenticated:'Y', PropertyCode:'PR006', Description:'August Rent Payment',     Amount: 2200, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00022' },

      // T007 — Grace Lee (PR001/UN003) rent=$1800
      { Date:'2024-03-15', TenantID:'T007', Authenticated:'Y', PropertyCode:'PR001', Description:'Security Deposit',        Amount: 3600, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00023' },
      { Date:'2024-04-01', TenantID:'T007', Authenticated:'Y', PropertyCode:'PR001', Description:'April Rent Payment',      Amount: 1800, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00024' },
      { Date:'2024-05-01', TenantID:'T007', Authenticated:'Y', PropertyCode:'PR001', Description:'May Rent Payment',        Amount: 1800, Currency:'USD', TransactionNote:'', TransactionDocument:'', UpdateUser:'System', transactionRef:'TXN-00025' }
    ]);
  }
};
