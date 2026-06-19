SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

--
-- Functions
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_version_chain() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE reports
    SET is_latest = false, updated_at = now()
    WHERE version_chain_id = NEW.version_chain_id
      AND id != NEW.id
      AND is_latest = true;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Tables
--

CREATE TABLE public.admin_boundaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crisis_event_id uuid,
    admin_level integer NOT NULL,
    name text NOT NULL,
    geometry extensions.geometry(MultiPolygon,4326) NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


CREATE TABLE public.building_footprints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crisis_event_id uuid,
    geometry extensions.geometry(Polygon,4326) NOT NULL,
    h3_r12 text,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


CREATE TABLE public.crisis_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    crisis_type text NOT NULL,
    region extensions.geometry(Polygon,4326),
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    follow_up_questions jsonb DEFAULT '[]'::jsonb NOT NULL
);


CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crisis_event_id uuid,
    location extensions.geometry(Point,4326) NOT NULL,
    h3_r12 text NOT NULL,
    h3_r8 text NOT NULL,
    damage_level text NOT NULL,
    ai_damage_level text,
    ai_confidence real,
    photo_url text,
    thumbnail_url text,
    infrastructure_type text[] NOT NULL,
    infrastructure_description text,
    crisis_nature text[] NOT NULL,
    debris_present boolean,
    electricity_status text,
    health_status text,
    pressing_needs text[],
    version_chain_id uuid NOT NULL,
    is_latest boolean DEFAULT true,
    device_id text,
    offline_queue_id text,
    submitted_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    building_id text,
    ai_infrastructure_type text[],
    duplicate_status text,
    related_report_id uuid,
    follow_up_responses jsonb,
    analyst_damage_level text,
    flag_status text,
    flag_reason text,
    infrastructure_description_en text,
    CONSTRAINT duplicate_status_valid CHECK (((duplicate_status IS NULL) OR (duplicate_status = ANY (ARRAY['possible_duplicate'::text, 'reassessment'::text])))),
    CONSTRAINT reports_ai_damage_level_check CHECK ((ai_damage_level = ANY (ARRAY['minimal'::text, 'partial'::text, 'complete'::text]))),
    CONSTRAINT reports_analyst_damage_level_check CHECK ((analyst_damage_level = ANY (ARRAY['minimal'::text, 'partial'::text, 'complete'::text]))),
    CONSTRAINT reports_damage_level_check CHECK ((damage_level = ANY (ARRAY['minimal'::text, 'partial'::text, 'complete'::text]))),
    CONSTRAINT reports_flag_status_check CHECK ((flag_status = ANY (ARRAY['suspect'::text, 'invalid'::text])))
);


--
-- Primary keys
--

ALTER TABLE ONLY public.admin_boundaries
    ADD CONSTRAINT admin_boundaries_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.building_footprints
    ADD CONSTRAINT building_footprints_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.crisis_events
    ADD CONSTRAINT crisis_events_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Indexes
--

CREATE INDEX idx_admin_boundaries_crisis_level ON public.admin_boundaries USING btree (crisis_event_id, admin_level);
CREATE INDEX idx_admin_boundaries_geom ON public.admin_boundaries USING gist (geometry);

CREATE INDEX idx_building_footprints_crisis ON public.building_footprints USING btree (crisis_event_id);
CREATE INDEX idx_building_footprints_geom ON public.building_footprints USING gist (geometry);
CREATE INDEX idx_building_footprints_h3_r12 ON public.building_footprints USING btree (h3_r12);

CREATE INDEX idx_crisis_events_active ON public.crisis_events USING btree (is_active);

CREATE INDEX idx_reports_building_id ON public.reports USING btree (building_id);
CREATE INDEX idx_reports_crisis ON public.reports USING btree (crisis_event_id);
CREATE INDEX idx_reports_crisis_nature_gin ON public.reports USING gin (crisis_nature);
CREATE INDEX idx_reports_damage_level ON public.reports USING btree (damage_level);
CREATE INDEX idx_reports_duplicate_status ON public.reports USING btree (duplicate_status);
CREATE INDEX idx_reports_flag_status ON public.reports USING btree (flag_status) WHERE (flag_status IS NOT NULL);
CREATE INDEX idx_reports_geom ON public.reports USING gist (location);
CREATE INDEX idx_reports_h3_r12 ON public.reports USING btree (h3_r12);
CREATE INDEX idx_reports_h3_r8 ON public.reports USING btree (h3_r8);
CREATE INDEX idx_reports_infrastructure_type_gin ON public.reports USING gin (infrastructure_type);
CREATE INDEX idx_reports_offline_queue ON public.reports USING btree (offline_queue_id);
CREATE INDEX idx_reports_pressing_needs_gin ON public.reports USING gin (pressing_needs);
CREATE INDEX idx_reports_related_report ON public.reports USING btree (related_report_id);
CREATE INDEX idx_reports_submitted_at ON public.reports USING btree (submitted_at);
CREATE INDEX idx_reports_version_chain ON public.reports USING btree (version_chain_id, is_latest);


--
-- Triggers
--

CREATE TRIGGER trg_crisis_events_updated_at BEFORE UPDATE ON public.crisis_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_update_version_chain AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_version_chain();


--
-- Foreign keys
--

ALTER TABLE ONLY public.admin_boundaries
    ADD CONSTRAINT admin_boundaries_crisis_event_id_fkey FOREIGN KEY (crisis_event_id) REFERENCES public.crisis_events(id);


ALTER TABLE ONLY public.building_footprints
    ADD CONSTRAINT building_footprints_crisis_event_id_fkey FOREIGN KEY (crisis_event_id) REFERENCES public.crisis_events(id);


ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_crisis_event_id_fkey FOREIGN KEY (crisis_event_id) REFERENCES public.crisis_events(id);


ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_related_report_id_fkey FOREIGN KEY (related_report_id) REFERENCES public.reports(id);
