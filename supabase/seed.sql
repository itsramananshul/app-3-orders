-- APP 3 — Orders Management: seed for 6 instances × 12 orders = 72 rows.
-- Run AFTER schema.sql. Idempotent upsert on (instance_name, order_number).
-- Re-run to reset to seed values; total_value is auto-derived (generated column).
--
-- Today (in the demo): 2026-05-13. Orders with due_date before that are
-- "overdue" unless DELIVERED. Each instance has at least one FLAGGED order
-- and at least one overdue order, so the dashboards have something to react to.

insert into public.orders
  (instance_name, order_number, customer, product_sku, product_name,
   quantity, unit_price, status, priority, due_date, notes)
values
  -- ─── Factory 1 ──────────────────────────────────────────────────────
  ('Factory 1','ORD-F1-001','Ford Motor Co',     'ENG-BLK-3500',  'Engine Block V6 3.5L',    50,   850.00,'PENDING',      'NORMAL','2026-06-01',''),
  ('Factory 1','ORD-F1-002','Boeing',            'PNL-STL-1422',  'Steel Panel 1422mm',     200,   145.00,'IN_PRODUCTION','HIGH',  '2026-05-20','QC inspection in progress'),
  ('Factory 1','ORD-F1-003','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards Gen-3',  1000,    22.50,'FLAGGED',      'URGENT','2026-05-08','[2026-05-09T14:02:00Z] Customer returned 50 units; investigating root cause'),
  ('Factory 1','ORD-F1-004','General Dynamics',  'TRN-UNT-6SPD',  'Transmission Unit 6-Spd', 25,  1200.00,'READY_TO_SHIP','NORMAL','2026-05-18',''),
  ('Factory 1','ORD-F1-005','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly 18x8',     80,   320.00,'SHIPPED',      'LOW',   '2026-05-10','Tracking: FX-9923-A'),
  ('Factory 1','ORD-F1-006','Honeywell',         'SNR-PKG-ADAS',  'Sensor Package ADAS',    200,   175.00,'DELIVERED',    'NORMAL','2026-04-25','Delivered to customer dock'),
  ('Factory 1','ORD-F1-007','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',          5000,     2.10,'IN_PRODUCTION','LOW',   '2026-06-15',''),
  ('Factory 1','ORD-F1-008','Raytheon',          'BAT-MOD-96V',   'Battery Module 96V',      30,  1850.00,'PENDING',      'URGENT','2026-05-12','Customer priority order'),
  ('Factory 1','ORD-F1-009','Boeing',            'DSH-UNT-CLU-3', 'Dashboard Unit Gen-3',   100,   285.00,'SHIPPED',      'HIGH',  '2026-05-08','Tracking: FX-8841-B'),
  ('Factory 1','ORD-F1-010','Ford Motor Co',     'BRK-ASM-FR-220','Brake Assembly Front',   400,    95.00,'IN_PRODUCTION','NORMAL','2026-06-05',''),
  ('Factory 1','ORD-F1-011','Lockheed Martin',   'SUS-KIT-HD',    'Suspension Kit HD',       50,   540.00,'PENDING',      'NORMAL','2026-06-10',''),
  ('Factory 1','ORD-F1-012','Caterpillar',       'WHR-HRN-A12',   'Wiring Harness A12',     200,   110.00,'FLAGGED',      'HIGH',  '2026-05-05','[2026-05-06T09:15:00Z] Defect rate at 8% - hold for QA review'),

  -- ─── Factory 2 ──────────────────────────────────────────────────────
  ('Factory 2','ORD-F2-001','Boeing',            'ENG-BLK-3500',  'Engine Block V6 3.5L',    75,   850.00,'IN_PRODUCTION','HIGH',  '2026-05-22',''),
  ('Factory 2','ORD-F2-002','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards Gen-3',   500,    24.00,'PENDING',      'URGENT','2026-05-25','Mil-spec certification required'),
  ('Factory 2','ORD-F2-003','Raytheon',          'SNR-PKG-ADAS',  'Sensor Package',         150,   195.00,'READY_TO_SHIP','NORMAL','2026-05-19',''),
  ('Factory 2','ORD-F2-004','General Dynamics',  'PNL-STL-1422',  'Steel Panel 1422mm',     400,   145.00,'SHIPPED',      'LOW',   '2026-05-09','Tracking: GD-1224-X'),
  ('Factory 2','ORD-F2-005','Honeywell',         'TRN-UNT-6SPD',  'Transmission Unit',       40,  1200.00,'DELIVERED',    'NORMAL','2026-04-30','Final acceptance complete'),
  ('Factory 2','ORD-F2-006','Ford Motor Co',     'BAT-MOD-96V',   'Battery Module 96V',      80,  1820.00,'PENDING',      'HIGH',  '2026-06-02',''),
  ('Factory 2','ORD-F2-007','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',          8000,     2.05,'IN_PRODUCTION','NORMAL','2026-06-12',''),
  ('Factory 2','ORD-F2-008','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly 18x8',    120,   320.00,'FLAGGED',      'HIGH',  '2026-05-06','[2026-05-07T11:22:00Z] Dimensional check failed on batch 7; requote required'),
  ('Factory 2','ORD-F2-009','Boeing',            'DSH-UNT-CLU-3', 'Dashboard Unit',         200,   290.00,'READY_TO_SHIP','URGENT','2026-05-15',''),
  ('Factory 2','ORD-F2-010','Lockheed Martin',   'WHR-HRN-A12',   'Wiring Harness Mil-spec',350,   135.00,'PENDING',      'NORMAL','2026-06-20',''),
  ('Factory 2','ORD-F2-011','Honeywell',         'SUS-KIT-HD',    'Suspension Kit HD',      100,   525.00,'SHIPPED',      'NORMAL','2026-05-11','Tracking: HW-5512-Z'),
  ('Factory 2','ORD-F2-012','Raytheon',          'BRK-ASM-FR-220','Brake Assembly',         300,    95.00,'IN_PRODUCTION','LOW',   '2026-06-08',''),

  -- ─── Factory 3 — many delays / supply issues ────────────────────────
  ('Factory 3','ORD-F3-001','Ford Motor Co',     'PNL-STL-1422',  'Steel Panel',            150,   145.00,'FLAGGED',      'URGENT','2026-04-28','[2026-04-29T08:00:00Z] Raw materials shortage; cannot start production'),
  ('Factory 3','ORD-F3-002','Boeing',            'ENG-BLK-3500',  'Engine Block',            30,   850.00,'PENDING',      'HIGH',  '2026-05-30',''),
  ('Factory 3','ORD-F3-003','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly',          50,   320.00,'IN_PRODUCTION','NORMAL','2026-06-05',''),
  ('Factory 3','ORD-F3-004','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards',         800,    22.50,'FLAGGED',      'URGENT','2026-05-05','[2026-05-06T10:30:00Z] Awaiting component supplier ETA'),
  ('Factory 3','ORD-F3-005','Raytheon',          'SNR-PKG-ADAS',  'Sensor Package',         100,   175.00,'PENDING',      'URGENT','2026-05-14',''),
  ('Factory 3','ORD-F3-006','General Dynamics',  'TRN-UNT-6SPD',  'Transmission Unit',       15,  1200.00,'READY_TO_SHIP','HIGH',  '2026-05-16',''),
  ('Factory 3','ORD-F3-007','Honeywell',         'BAT-MOD-96V',   'Battery Module',          20,  1850.00,'PENDING',      'NORMAL','2026-06-15',''),
  ('Factory 3','ORD-F3-008','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',          4000,     2.10,'DELIVERED',    'LOW',   '2026-04-22','Customer-confirmed delivery'),
  ('Factory 3','ORD-F3-009','Ford Motor Co',     'DSH-UNT-CLU-3', 'Dashboard Unit',          50,   285.00,'SHIPPED',      'NORMAL','2026-05-08','Tracking: FX-7723-Q'),
  ('Factory 3','ORD-F3-010','Boeing',            'BRK-ASM-FR-220','Brake Assembly',         200,    95.00,'IN_PRODUCTION','NORMAL','2026-06-04',''),
  ('Factory 3','ORD-F3-011','Caterpillar',       'SUS-KIT-HD',    'Suspension Kit HD',       30,   540.00,'PENDING',      'LOW',   '2026-06-20',''),
  ('Factory 3','ORD-F3-012','Lockheed Martin',   'WHR-HRN-A12',   'Wiring Harness',         250,   135.00,'FLAGGED',      'HIGH',  '2026-05-07','[2026-05-08T13:45:00Z] Subassembly defect; rebuilding batch'),

  -- ─── Factory 4 — high-throughput, lots of urgent work ───────────────
  ('Factory 4','ORD-F4-001','Boeing',            'ENG-BLK-3500',  'Engine Block V6',        120,   850.00,'IN_PRODUCTION','URGENT','2026-05-18',''),
  ('Factory 4','ORD-F4-002','Ford Motor Co',     'PNL-STL-1422',  'Steel Panel',            600,   145.00,'IN_PRODUCTION','URGENT','2026-05-20',''),
  ('Factory 4','ORD-F4-003','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards',        1500,    22.50,'READY_TO_SHIP','HIGH',  '2026-05-15',''),
  ('Factory 4','ORD-F4-004','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly',         250,   320.00,'PENDING',      'HIGH',  '2026-05-25',''),
  ('Factory 4','ORD-F4-005','General Dynamics',  'TRN-UNT-6SPD',  'Transmission Unit',       60,  1200.00,'SHIPPED',      'URGENT','2026-05-10','Tracking: GD-9912-Y'),
  ('Factory 4','ORD-F4-006','Raytheon',          'SNR-PKG-ADAS',  'Sensor Package',         300,   195.00,'IN_PRODUCTION','URGENT','2026-05-19',''),
  ('Factory 4','ORD-F4-007','Honeywell',         'BAT-MOD-96V',   'Battery Module',         100,  1820.00,'SHIPPED',      'HIGH',  '2026-05-09','Tracking: HW-4498-K'),
  ('Factory 4','ORD-F4-008','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',         10000,     2.10,'IN_PRODUCTION','NORMAL','2026-06-01',''),
  ('Factory 4','ORD-F4-009','Boeing',            'DSH-UNT-CLU-3', 'Dashboard Unit',         200,   290.00,'READY_TO_SHIP','HIGH',  '2026-05-17',''),
  ('Factory 4','ORD-F4-010','Ford Motor Co',     'BRK-ASM-FR-220','Brake Assembly',         700,    95.00,'IN_PRODUCTION','HIGH',  '2026-05-22',''),
  ('Factory 4','ORD-F4-011','Lockheed Martin',   'WHR-HRN-A12',   'Wiring Harness',         500,   135.00,'PENDING',      'URGENT','2026-05-21',''),
  ('Factory 4','ORD-F4-012','Caterpillar',       'SUS-KIT-HD',    'Suspension Kit HD',      150,   540.00,'FLAGGED',      'URGENT','2026-05-04','[2026-05-05T07:55:00Z] Stress test failure; full batch re-inspection underway'),

  -- ─── Warehouse 1 — bulk outbound shipments ──────────────────────────
  ('Warehouse 1','ORD-W1-001','Ford Motor Co',     'ENG-BLK-3500',  'Engine Block V6',     200,   845.00,'SHIPPED',      'NORMAL','2026-05-09','Tracking: W1-2231-A'),
  ('Warehouse 1','ORD-W1-002','Boeing',            'PNL-STL-1422',  'Steel Panel',        1500,   142.00,'SHIPPED',      'HIGH',  '2026-05-10','Tracking: W1-2245-B'),
  ('Warehouse 1','ORD-W1-003','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards',     5000,    22.00,'READY_TO_SHIP','HIGH',  '2026-05-14',''),
  ('Warehouse 1','ORD-W1-004','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly',      500,   318.00,'DELIVERED',    'NORMAL','2026-04-28','Delivered'),
  ('Warehouse 1','ORD-W1-005','General Dynamics',  'TRN-UNT-6SPD',  'Transmission Unit',   100,  1190.00,'READY_TO_SHIP','URGENT','2026-05-15',''),
  ('Warehouse 1','ORD-W1-006','Raytheon',          'SNR-PKG-ADAS',  'Sensor Package',      800,   190.00,'SHIPPED',      'NORMAL','2026-05-08','Tracking: W1-2298-C'),
  ('Warehouse 1','ORD-W1-007','Honeywell',         'BAT-MOD-96V',   'Battery Module',      200,  1810.00,'PENDING',      'HIGH',  '2026-05-28',''),
  ('Warehouse 1','ORD-W1-008','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',      50000,     2.00,'PENDING',      'LOW',   '2026-06-15',''),
  ('Warehouse 1','ORD-W1-009','Boeing',            'DSH-UNT-CLU-3', 'Dashboard Unit',      500,   285.00,'DELIVERED',    'NORMAL','2026-05-02','Customer-confirmed delivery'),
  ('Warehouse 1','ORD-W1-010','Ford Motor Co',     'BRK-ASM-FR-220','Brake Assembly',     2000,    92.00,'IN_PRODUCTION','NORMAL','2026-05-30',''),
  ('Warehouse 1','ORD-W1-011','Lockheed Martin',   'WHR-HRN-A12',   'Wiring Harness',     1200,   132.00,'SHIPPED',      'NORMAL','2026-05-11','Tracking: W1-2356-D'),
  ('Warehouse 1','ORD-W1-012','Caterpillar',       'SUS-KIT-HD',    'Suspension Kit HD',   300,   530.00,'FLAGGED',      'HIGH',  '2026-05-06','[2026-05-07T15:10:00Z] Pallet-3 manifest mismatch — recount in progress'),

  -- ─── Warehouse 2 — smaller depot, mixed pace ────────────────────────
  ('Warehouse 2','ORD-W2-001','Ford Motor Co',     'ENG-BLK-3500',  'Engine Block V6',      60,   850.00,'PENDING',      'NORMAL','2026-05-26',''),
  ('Warehouse 2','ORD-W2-002','Boeing',            'PNL-STL-1422',  'Steel Panel',         400,   145.00,'IN_PRODUCTION','NORMAL','2026-06-03',''),
  ('Warehouse 2','ORD-W2-003','Lockheed Martin',   'CIR-BRD-009',   'Circuit Boards',      600,    22.50,'READY_TO_SHIP','HIGH',  '2026-05-16',''),
  ('Warehouse 2','ORD-W2-004','Caterpillar',       'WHL-ASM-18X8',  'Wheel Assembly',      150,   320.00,'SHIPPED',      'NORMAL','2026-05-10','Tracking: W2-3312-E'),
  ('Warehouse 2','ORD-W2-005','General Dynamics',  'TRN-UNT-6SPD',  'Transmission Unit',    25,  1200.00,'DELIVERED',    'LOW',   '2026-04-20','Delivered'),
  ('Warehouse 2','ORD-W2-006','Raytheon',          'SNR-PKG-ADAS',  'Sensor Package',      100,   195.00,'PENDING',      'URGENT','2026-05-15',''),
  ('Warehouse 2','ORD-W2-007','Honeywell',         'BAT-MOD-96V',   'Battery Module',       40,  1850.00,'IN_PRODUCTION','HIGH',  '2026-05-24',''),
  ('Warehouse 2','ORD-W2-008','3M Industrial',     'RBR-SLS-004',   'Rubber Seals',       7000,     2.05,'PENDING',      'LOW',   '2026-06-18',''),
  ('Warehouse 2','ORD-W2-009','Boeing',            'DSH-UNT-CLU-3', 'Dashboard Unit',       80,   285.00,'SHIPPED',      'NORMAL','2026-05-09','Tracking: W2-3367-F'),
  ('Warehouse 2','ORD-W2-010','Ford Motor Co',     'BRK-ASM-FR-220','Brake Assembly',      300,    95.00,'FLAGGED',      'HIGH',  '2026-05-07','[2026-05-08T11:30:00Z] Mis-pick on warehouse aisle 12; correcting'),
  ('Warehouse 2','ORD-W2-011','Lockheed Martin',   'WHR-HRN-A12',   'Wiring Harness',      200,   135.00,'PENDING',      'NORMAL','2026-06-08',''),
  ('Warehouse 2','ORD-W2-012','Caterpillar',       'SUS-KIT-HD',    'Suspension Kit HD',    60,   540.00,'DELIVERED',    'NORMAL','2026-04-26','Delivered')

on conflict (instance_name, order_number) do update set
  customer     = excluded.customer,
  product_sku  = excluded.product_sku,
  product_name = excluded.product_name,
  quantity     = excluded.quantity,
  unit_price   = excluded.unit_price,
  status       = excluded.status,
  priority     = excluded.priority,
  due_date     = excluded.due_date,
  notes        = excluded.notes,
  updated_at   = now();
