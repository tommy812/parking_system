--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED'
);


--
-- Name: owner_registration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.owner_registration_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'REQUIRES_PAYMENT',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    parking_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    status public.booking_status DEFAULT 'PENDING'::public.booking_status NOT NULL,
    total_amount_pence integer DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bookings_check CHECK ((end_at > start_at)),
    CONSTRAINT bookings_total_amount_pence_check CHECK ((total_amount_pence >= 0))
);


--
-- Name: owner_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    parking_id uuid NOT NULL,
    status public.owner_registration_status DEFAULT 'PENDING'::public.owner_registration_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    note text
);


--
-- Name: parking_blackouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parking_blackouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parking_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parking_blackouts_check CHECK ((end_at > start_at))
);


--
-- Name: parkings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parkings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    timezone text DEFAULT 'Europe/London'::text NOT NULL,
    capacity integer NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    lat double precision,
    lng double precision,
    open_start_minute_utc integer DEFAULT 0 NOT NULL,
    open_end_minute_utc integer DEFAULT 1440 NOT NULL,
    min_booking_minutes integer DEFAULT 15 NOT NULL,
    max_booking_minutes integer DEFAULT 1440 NOT NULL,
    buffer_minutes integer DEFAULT 0 NOT NULL,
    CONSTRAINT parkings_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT parkings_schedule_check CHECK (((open_start_minute_utc >= 0) AND (open_start_minute_utc <= 1440) AND (open_end_minute_utc >= 0) AND (open_end_minute_utc <= 1440) AND (open_end_minute_utc > open_start_minute_utc) AND (min_booking_minutes > 0) AND (max_booking_minutes >= min_booking_minutes) AND (buffer_minutes >= 0)))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    provider text DEFAULT 'stripe'::text NOT NULL,
    provider_payment_id text,
    status public.payment_status DEFAULT 'REQUIRES_PAYMENT'::public.payment_status NOT NULL,
    amount_pence integer NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_pence_check CHECK ((amount_pence >= 0))
);


--
-- Name: pricing_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parking_id uuid NOT NULL,
    max_minutes integer NOT NULL,
    price_pence integer NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_tiers_max_minutes_check CHECK ((max_minutes > 0)),
    CONSTRAINT pricing_tiers_price_pence_check CHECK ((price_pence >= 0))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'USER'::text NOT NULL,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    vehicle_reg text,
    vehicle_model text,
    vehicle_color text,
    vehicle_year integer,
    is_approved boolean DEFAULT true NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['USER'::text, 'ADMIN'::text, 'OWNER'::text]))),
    CONSTRAINT users_vehicle_year_check CHECK (((vehicle_year IS NULL) OR ((vehicle_year >= 1900) AND (vehicle_year <= 2100))))
);


--
-- Name: bookings bookings_no_overlap_user_parking; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_no_overlap_user_parking EXCLUDE USING gist (user_id WITH =, parking_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['PENDING'::public.booking_status, 'CONFIRMED'::public.booking_status])));


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: owner_registrations owner_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_registrations
    ADD CONSTRAINT owner_registrations_pkey PRIMARY KEY (id);


--
-- Name: owner_registrations owner_registrations_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_registrations
    ADD CONSTRAINT owner_registrations_user_id_key UNIQUE (user_id);


--
-- Name: parking_blackouts parking_blackouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_blackouts
    ADD CONSTRAINT parking_blackouts_pkey PRIMARY KEY (id);


--
-- Name: parkings parkings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parkings
    ADD CONSTRAINT parkings_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pricing_tiers pricing_tiers_parking_id_max_minutes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_tiers
    ADD CONSTRAINT pricing_tiers_parking_id_max_minutes_key UNIQUE (parking_id, max_minutes);


--
-- Name: pricing_tiers pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_tiers
    ADD CONSTRAINT pricing_tiers_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_bookings_parking_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_parking_time ON public.bookings USING btree (parking_id, start_at, end_at);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_owner_registrations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_registrations_status ON public.owner_registrations USING btree (status);


--
-- Name: idx_parking_blackouts_parking_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parking_blackouts_parking_time ON public.parking_blackouts USING btree (parking_id, start_at, end_at);


--
-- Name: idx_parkings_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parkings_owner_user_id ON public.parkings USING btree (owner_user_id);


--
-- Name: idx_payments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_booking ON public.payments USING btree (booking_id);


--
-- Name: idx_pricing_tiers_parking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_tiers_parking ON public.pricing_tiers USING btree (parking_id);


--
-- Name: bookings bookings_parking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_parking_id_fkey FOREIGN KEY (parking_id) REFERENCES public.parkings(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: owner_registrations owner_registrations_parking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_registrations
    ADD CONSTRAINT owner_registrations_parking_id_fkey FOREIGN KEY (parking_id) REFERENCES public.parkings(id) ON DELETE CASCADE;


--
-- Name: owner_registrations owner_registrations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_registrations
    ADD CONSTRAINT owner_registrations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: owner_registrations owner_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_registrations
    ADD CONSTRAINT owner_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parking_blackouts parking_blackouts_parking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_blackouts
    ADD CONSTRAINT parking_blackouts_parking_id_fkey FOREIGN KEY (parking_id) REFERENCES public.parkings(id) ON DELETE CASCADE;


--
-- Name: parkings parkings_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parkings
    ADD CONSTRAINT parkings_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: pricing_tiers pricing_tiers_parking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_tiers
    ADD CONSTRAINT pricing_tiers_parking_id_fkey FOREIGN KEY (parking_id) REFERENCES public.parkings(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

