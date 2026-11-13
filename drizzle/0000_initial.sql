-- SalonBridge Initial Schema Migration (PostgreSQL 16 + PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Auth & Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(20) UNIQUE,
  email varchar(255) UNIQUE,
  google_id varchar(255) UNIQUE,
  full_name varchar(120),
  avatar_url text,
  totp_secret_enc text,
  totp_enabled boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash varchar(128) NOT NULL,
  user_agent text,
  ip_address varchar(64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash ON auth_sessions (refresh_token_hash);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(20) NOT NULL,
  code_hash varchar(128) NOT NULL,
  channel varchar(20) NOT NULL DEFAULT 'whatsapp',
  purpose varchar(20) NOT NULL DEFAULT 'login',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_challenges (phone, created_at);

-- 2. Salons & Staff
CREATE TABLE IF NOT EXISTS salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slug varchar(160) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  description text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  gender_focus varchar(20) NOT NULL DEFAULT 'unisex',
  phone varchar(20) NOT NULL,
  email varchar(255),
  address_line1 varchar(255) NOT NULL,
  address_line2 varchar(255),
  city varchar(100) NOT NULL,
  state varchar(100) NOT NULL,
  pincode varchar(16) NOT NULL,
  country_code varchar(2) NOT NULL DEFAULT 'IN',
  currency varchar(3) NOT NULL DEFAULT 'INR',
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
  location geography(Point, 4326) NOT NULL,
  gstin varchar(20),
  license_doc_key text,
  razorpay_account_id varchar(100),
  razorpay_kyc_status varchar(30) NOT NULL DEFAULT 'pending',
  manual_booking_approval boolean NOT NULL DEFAULT false,
  slot_interval_minutes integer NOT NULL DEFAULT 15,
  buffer_minutes integer NOT NULL DEFAULT 0,
  max_concurrent_bookings integer NOT NULL DEFAULT 4,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  avg_rating numeric(3, 2) NOT NULL DEFAULT 0.00,
  review_count integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  commission_rate_bps integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_owner ON salons (owner_id);
CREATE INDEX IF NOT EXISTS idx_salons_status_city ON salons (status, city);
CREATE INDEX IF NOT EXISTS idx_salons_location_gist ON salons USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_salons_name_trgm ON salons USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS salon_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salon_members_salon_user ON salon_members (salon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_salon_members_user ON salon_members (user_id);

CREATE TABLE IF NOT EXISTS salon_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  file_key text NOT NULL,
  caption varchar(200),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salon_photos_salon ON salon_photos (salon_id);

CREATE TABLE IF NOT EXISTS salon_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_salon_hours_day ON salon_hours (salon_id, day_of_week);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name varchar(120) NOT NULL,
  title varchar(100),
  bio text,
  avatar_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_salon ON staff (salon_id, is_active);

CREATE TABLE IF NOT EXISTS staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  is_off boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_schedules_day ON staff_schedules (staff_id, day_of_week);

CREATE TABLE IF NOT EXISTS staff_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_date date NOT NULL,
  start_time time,
  end_time time,
  reason varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff_date ON staff_leaves (staff_id, leave_date);

-- 3. Service Catalog & AI Menu Imports
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_categories_salon ON service_categories (salon_id);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  description text,
  price_paise integer NOT NULL,
  compare_at_price_paise integer,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  duration_minutes integer NOT NULL,
  gender_tag varchar(20) NOT NULL DEFAULT 'unisex',
  is_combo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_salon_active ON services (salon_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_name_trgm ON services USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS service_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  price_paise integer NOT NULL,
  duration_minutes integer NOT NULL,
  is_addon boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_service_variants_service ON service_variants (service_id);

CREATE TABLE IF NOT EXISTS staff_services (
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS menu_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_type varchar(20) NOT NULL,
  file_key text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'queued',
  raw_output jsonb,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_paise integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_import_jobs_salon ON menu_import_jobs (salon_id, created_at);

CREATE TABLE IF NOT EXISTS menu_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES menu_import_jobs(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_name varchar(120) NOT NULL,
  service_name varchar(180) NOT NULL,
  description text,
  price_paise integer,
  max_price_paise integer,
  is_starting_from boolean NOT NULL DEFAULT false,
  duration_minutes integer NOT NULL DEFAULT 30,
  gender_tag varchar(20) NOT NULL DEFAULT 'unisex',
  confidence numeric(3, 2) NOT NULL DEFAULT 1.00,
  review_status varchar(20) NOT NULL DEFAULT 'pending',
  flags jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_menu_import_items_job ON menu_import_items (job_id);

CREATE TABLE IF NOT EXISTS menu_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  import_job_id uuid REFERENCES menu_import_jobs(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_versions_salon ON menu_versions (salon_id, version_number);

-- 4. Bookings, Slot Holds, Payments, Reviews
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code varchar(24) NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'pending_payment',
  payment_mode varchar(20) NOT NULL DEFAULT 'online',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  subtotal_paise integer NOT NULL,
  discount_paise integer NOT NULL DEFAULT 0,
  tax_paise integer NOT NULL DEFAULT 0,
  total_amount_paise integer NOT NULL,
  commission_paise integer NOT NULL DEFAULT 0,
  coupon_code varchar(40),
  customer_notes text,
  cancellation_reason text,
  cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  is_walk_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_salon_start ON bookings (salon_id, start_at, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id, created_at);

CREATE TABLE IF NOT EXISTS booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES service_variants(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  service_name_snapshot varchar(180) NOT NULL,
  price_paise integer NOT NULL,
  duration_minutes integer NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking ON booking_items (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_staff_time ON booking_items (salon_id, staff_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slot_holds_lookup ON slot_holds (salon_id, staff_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_slot_holds_expires ON slot_holds (expires_at);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  provider varchar(30) NOT NULL DEFAULT 'razorpay',
  provider_order_id varchar(120),
  provider_payment_id varchar(120) UNIQUE,
  provider_transfer_id varchar(120),
  amount_paise integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  status varchar(30) NOT NULL DEFAULT 'created',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  provider_refund_id varchar(120) UNIQUE,
  amount_paise integer NOT NULL,
  reason text,
  status varchar(30) NOT NULL DEFAULT 'pending',
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds (booking_id);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  provider_transfer_id varchar(120) UNIQUE,
  amount_paise integer NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_salon ON payouts (salon_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  comment text,
  salon_reply text,
  salon_replied_at timestamptz,
  is_reported boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_salon ON reviews (salon_id, is_hidden, created_at);

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, salon_id)
);

-- 5. Platform, Subscriptions, Audit & Config
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  monthly_price_paise integer NOT NULL,
  ai_imports_per_month integer NOT NULL,
  max_staff integer NOT NULL,
  commission_rate_bps integer NOT NULL,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  provider_subscription_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_salon ON subscriptions (salon_id, status);

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL UNIQUE,
  discount_type varchar(20) NOT NULL,
  discount_value integer NOT NULL,
  max_discount_paise integer,
  min_order_paise integer NOT NULL DEFAULT 0,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL,
  recipient varchar(255) NOT NULL,
  template_key varchar(80) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'queued',
  provider_message_id varchar(120),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  impersonated_salon_id uuid REFERENCES salons(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(60) NOT NULL,
  resource_id varchar(100),
  ip_address varchar(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

CREATE TABLE IF NOT EXISTS feature_flags (
  key varchar(100) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_configs (
  key varchar(100) PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

