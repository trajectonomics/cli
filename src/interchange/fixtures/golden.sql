-- The golden fixture database, as literal rows. Run against a database migrated to schema
-- version 2; the seeded personal entity already exists and is updated in place. Ids sort so
-- that an account's parent, a void's linked transaction and a fork's origin all come later in
-- the export than the row that points at them.
UPDATE entity SET name = 'ส่วนตัว', version = 2, updated_at = '2026-01-01T08:00:00.000Z'
WHERE id = '00000000-0000-7000-8000-000000000001';

INSERT INTO account (id, entity_id, name, type, currency, parent_id, archived_at, version,
	created_at, updated_at, deleted_at) VALUES
('0194a000-0001-7000-8000-000000000001', '00000000-0000-7000-8000-000000000001', 'ธนาคารกสิกร',
	'asset', 'THB', '0194a000-0009-7000-8000-000000000009', NULL, 1,
	'2026-01-01T09:00:01.001Z', '2026-01-01T09:00:01.001Z', NULL),
('0194a000-0002-7000-8000-000000000002', '00000000-0000-7000-8000-000000000001', 'Salary',
	'income', 'THB', NULL, NULL, 1,
	'2026-01-01T09:00:02.002Z', '2026-01-01T09:00:02.002Z', NULL),
('0194a000-0003-7000-8000-000000000003', '00000000-0000-7000-8000-000000000001', 'อาหาร',
	'expense', 'THB', NULL, NULL, 1,
	'2026-01-01T09:00:03.003Z', '2026-01-01T09:00:03.003Z', NULL),
('0194a000-0004-7000-8000-000000000004', '00000000-0000-7000-8000-000000000001', 'Old wallet',
	'asset', 'THB', NULL, '2026-01-20T09:30:00.250Z', 2,
	'2026-01-01T09:00:04.004Z', '2026-01-20T09:30:00.250Z', NULL),
('0194a000-0005-7000-8000-000000000005', '00000000-0000-7000-8000-000000000001', 'Typo account',
	'expense', 'THB', NULL, NULL, 2,
	'2026-01-01T09:00:05.005Z', '2026-01-02T10:00:00.500Z', '2026-01-02T10:00:00.500Z'),
('0194a000-0006-7000-8000-000000000006', '00000000-0000-7000-8000-000000000001',
	'Opening balances', 'equity', 'THB', NULL, NULL, 1,
	'2026-01-01T09:00:06.006Z', '2026-01-01T09:00:06.006Z', NULL),
('0194a000-0009-7000-8000-000000000009', '00000000-0000-7000-8000-000000000001', 'Assets',
	'asset', 'THB', NULL, NULL, 1,
	'2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z', NULL);

INSERT INTO tx (id, entity_id, date, memo, linked_to, external_ref, version, created_at,
	updated_at, correction_kind) VALUES
('0194b000-0001-7000-8000-000000000001', '00000000-0000-7000-8000-000000000001', '2026-01-05',
	'ยอดยกมา', NULL, 'kbank:2026-01-05:0001', 1,
	'2026-01-05T12:00:00.100Z', '2026-01-05T12:00:00.100Z', NULL),
('0194b000-0002-7000-8000-000000000002', '00000000-0000-7000-8000-000000000001', '2026-01-10',
	NULL, NULL, NULL, 1, '2026-01-10T12:00:00.200Z', '2026-01-10T12:00:00.200Z', NULL),
('0194b000-0003-7000-8000-000000000003', '00000000-0000-7000-8000-000000000001', '2026-01-12',
	'void', '0194b000-0004-7000-8000-000000000004', NULL, 1,
	'2026-01-12T18:00:00.400Z', '2026-01-12T18:00:00.400Z', 'reversal'),
('0194b000-0004-7000-8000-000000000004', '00000000-0000-7000-8000-000000000001', '2026-01-12',
	'Lunch', NULL, NULL, 1, '2026-01-12T12:00:00.300Z', '2026-01-12T12:00:00.300Z', NULL);

INSERT INTO posting (tx_id, ordinal, account_id, amount, currency, dimensions) VALUES
('0194b000-0001-7000-8000-000000000001', 0, '0194a000-0001-7000-8000-000000000001',
	9007199254740991, 'THB', NULL),
('0194b000-0001-7000-8000-000000000001', 1, '0194a000-0006-7000-8000-000000000006',
	-9007199254740991, 'THB', NULL),
('0194b000-0002-7000-8000-000000000002', 0, '0194a000-0001-7000-8000-000000000001',
	5000000, 'THB', '{"channel":"transfer","project":"ร้านกาแฟ"}'),
('0194b000-0002-7000-8000-000000000002', 1, '0194a000-0002-7000-8000-000000000002',
	-5000000, 'THB', NULL),
('0194b000-0003-7000-8000-000000000003', 0, '0194a000-0003-7000-8000-000000000003',
	-12550, 'THB', NULL),
('0194b000-0003-7000-8000-000000000003', 1, '0194a000-0004-7000-8000-000000000004',
	12550, 'THB', NULL),
('0194b000-0004-7000-8000-000000000004', 0, '0194a000-0003-7000-8000-000000000003',
	12550, 'THB', '{"project":"ร้านกาแฟ"}'),
('0194b000-0004-7000-8000-000000000004', 1, '0194a000-0004-7000-8000-000000000004',
	-12550, 'THB', NULL);

INSERT INTO scenario (id, entity_id, name, document, content_hash, forked_from, version,
	created_at, updated_at, deleted_at) VALUES
('0194c000-0001-7000-8000-000000000001', '00000000-0000-7000-8000-000000000001', 'ทางเลือก',
	'{"accounts":[{"id":"savings","kind":"asset","rate":275},{"id":"mortgage","kind":"liability","rate":500}],"cashflow":{"surplus":[{"account":"savings"}],"withdraw":["savings"]},"currency":"THB","economy":{"inflation":300},"flows":[{"amount":5500000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"}],"schemaVersion":1}',
	'jcs1:sha256:b6cf5d904a27d9867024452f04bb768bbe8443a74f2ffb8fac969d412ef46198',
	'0194c000-0002-7000-8000-000000000002', 2,
	'2026-02-01T10:00:00.010Z', '2026-02-03T10:00:00.030Z', NULL),
('0194c000-0002-7000-8000-000000000002', '00000000-0000-7000-8000-000000000001', 'base',
	'{"accounts":[{"id":"savings","kind":"asset","rate":250},{"id":"mortgage","kind":"liability","rate":500}],"cashflow":{"surplus":[{"account":"savings"}],"withdraw":["savings"]},"currency":"THB","economy":{"inflation":300},"flows":[{"amount":5000000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"}],"schemaVersion":1}',
	'jcs1:sha256:ad03182eec95fa2a674eeb021e33e67a3d42a4ca9631a686b7727da9bde3b358',
	NULL, 1, '2026-01-31T10:00:00.000Z', '2026-01-31T10:00:00.000Z', NULL),
('0194c000-0003-7000-8000-000000000003', '00000000-0000-7000-8000-000000000001', 'draft',
	'{"accounts":[{"id":"draft-cash","kind":"asset","rate":125}],"cashflow":{"surplus":[{"account":"draft-cash"}],"withdraw":["draft-cash"]},"currency":"THB","economy":{"inflation":0},"flows":[{"amount":1,"earned":true,"frequency":"monthly","growth":"inflation","id":"draft-salary","kind":"income","start":"2026-01-01"}],"schemaVersion":1}',
	'jcs1:sha256:407c136eeee5315c349d6e459364fbc7c77b9647f98c5ea026bbe5fc2467cef3',
	NULL, 2, '2026-02-02T10:00:00.020Z', '2026-02-04T10:00:00.040Z', '2026-02-04T10:00:00.040Z');
