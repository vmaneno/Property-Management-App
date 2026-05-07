-- Property Management App — PostgreSQL Schema

CREATE TABLE IF NOT EXISTS agencies (
  agency_code   VARCHAR(20)  PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_master     BOOLEAN      NOT NULL DEFAULT false,
  active        BOOLEAN      NOT NULL DEFAULT true,
  data          JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS clients (
  client_code   VARCHAR(20)  PRIMARY KEY,
  agency_code   VARCHAR(20)  NOT NULL REFERENCES agencies(agency_code) ON DELETE CASCADE,
  username      VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  active        BOOLEAN      NOT NULL DEFAULT true,
  data          JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS properties (
  property_code VARCHAR(20) PRIMARY KEY,
  client_code   VARCHAR(20) NOT NULL,
  agency_code   VARCHAR(20) NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT true,
  data          JSONB       NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS prop_units (
  unit_code     VARCHAR(20) PRIMARY KEY,
  property_code VARCHAR(20) NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT true,
  data          JSONB       NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id     VARCHAR(20)  PRIMARY KEY,
  property_code VARCHAR(20)  NOT NULL,
  unit_code     VARCHAR(20),
  username      VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  active        BOOLEAN      NOT NULL DEFAULT true,
  data          JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_ref VARCHAR(20)  PRIMARY KEY,
  tenant_id       VARCHAR(20)  NOT NULL,
  property_code   VARCHAR(20)  NOT NULL,
  trans_ref       VARCHAR(100) UNIQUE,
  bank_rec        CHAR(1)      NOT NULL DEFAULT 'N',
  data            JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  id         SERIAL      PRIMARY KEY,
  role       VARCHAR(10) NOT NULL,
  username   VARCHAR(100) NOT NULL,
  code       VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_clients_agency     ON clients(agency_code);
CREATE INDEX IF NOT EXISTS idx_properties_client  ON properties(client_code);
CREATE INDEX IF NOT EXISTS idx_properties_agency  ON properties(agency_code);
CREATE INDEX IF NOT EXISTS idx_units_property     ON prop_units(property_code);
CREATE INDEX IF NOT EXISTS idx_tenants_property   ON tenants(property_code);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_prop   ON transactions(property_code);
