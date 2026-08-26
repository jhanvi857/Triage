-- Ledger Gateway Database Schema (Postgres & SQLite Compatible)

CREATE TABLE IF NOT EXISTS budget_buckets (
    agent_id VARCHAR(128) PRIMARY KEY,
    capacity_paise BIGINT NOT NULL,
    remaining_paise BIGINT NOT NULL,
    spent_paise BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    refill_rate_paise_per_sec BIGINT NOT NULL DEFAULT 0,
    last_refill_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(128) PRIMARY KEY,
    agent_id VARCHAR(128) NOT NULL,
    product_id VARCHAR(128) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_paise BIGINT NOT NULL,
    total_amount_paise BIGINT NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    status VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    razorpay_order_id VARCHAR(128),
    razorpay_payment_id VARCHAR(128),
    reasoning TEXT,
    gate_verdict VARCHAR(64) NOT NULL,
    gate_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(128) PRIMARY KEY,
    event_id VARCHAR(128) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    agent_id VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    reasoning TEXT,
    gate_decision VARCHAR(64) NOT NULL,
    gate_reason TEXT,
    rule_breakdown TEXT,
    order_id VARCHAR(128),
    amount_paise BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    idempotency_key VARCHAR(255),
    status VARCHAR(64) NOT NULL,
    prev_hash VARCHAR(128),
    entry_hash VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    status VARCHAR(64) NOT NULL,
    response_code INT,
    response_body TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(128) PRIMARY KEY,
    order_id VARCHAR(128) NOT NULL,
    agent_id VARCHAR(128) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    reason TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
    reviewer VARCHAR(128),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL,
    description TEXT,
    price_paise BIGINT NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    stock INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
