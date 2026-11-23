CREATE TABLE IF NOT EXISTS instances (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  instance_name TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'all',
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_nodes (
  id SERIAL PRIMARY KEY,
  flow_id INT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  name TEXT,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flow_node_actions (
  id SERIAL PRIMARY KEY,
  node_id INT NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flow_connections (
  id SERIAL PRIMARY KEY,
  flow_id INT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  from_node_id INT NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  to_node_id INT NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition_config JSONB NOT NULL DEFAULT '{"type":"always"}'
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  name TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (phone, instance_name)
);

CREATE TABLE IF NOT EXISTS contact_flow_states (
  id SERIAL PRIMARY KEY,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  flow_id INT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  current_node_id INT REFERENCES flow_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  variables JSONB NOT NULL DEFAULT '{}',
  save_field TEXT,
  timeout_job_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id, flow_id)
);

CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  contact_id INT REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  action_type TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
