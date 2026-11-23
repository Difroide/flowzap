-- schema-v2.sql — aplicar com: psql $DATABASE_URL -f backend/schema-v2.sql

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,
  flow_id INT REFERENCES flows(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  raw_amount_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  instance_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL,
  body TEXT,
  media_url TEXT,
  media_type TEXT,
  whatsapp_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv
  ON chat_messages (instance_name, phone, created_at DESC);

ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);

CREATE OR REPLACE VIEW v_dashboard AS
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*)                       AS sales_count,
  SUM(amount)                    AS revenue
FROM sales
GROUP BY 1;
