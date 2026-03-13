-- ZÁLOHA ŠTRUKTÚRY DATABÁZY: 2026-03-02_13-42
-- Obsahuje: Create Table, Views, Functions


-- TABUĽKA: sklady
CREATE TABLE IF NOT EXISTS public.sklady (
    id bigint NOT NULL,
    nazov text NOT NULL,
    poradie integer NULL
);


-- TABUĽKA: regaly
CREATE TABLE IF NOT EXISTS public.regaly (
    id bigint NOT NULL,
    sklad_id bigint NULL,
    nazov text NOT NULL,
    poradie integer NULL
);


-- TABUĽKA: produkty
CREATE TABLE IF NOT EXISTS public.produkty (
    id bigint NOT NULL,
    kategoria_id bigint NULL,
    nazov text NOT NULL,
    ean text NULL,
    jednotka text NULL,
    min_limit integer NULL,
    created_at timestamp with time zone NULL,
    balenie_ks numeric NULL,
    vlastne_id text NULL,
    stredisko_id bigint NULL,
    Interne_id bigint NULL
);


-- TABUĽKA: kategorie
CREATE TABLE IF NOT EXISTS public.kategorie (
    id bigint NOT NULL,
    nazov text NOT NULL,
    created_at timestamp with time zone NULL,
    poradie integer NULL
);


-- TABUĽKA: strediska
CREATE TABLE IF NOT EXISTS public.strediska (
    id bigint NOT NULL,
    nazov text NOT NULL,
    created_at timestamp with time zone NULL
);


-- TABUĽKA: skladove_zasoby
CREATE TABLE IF NOT EXISTS public.skladove_zasoby (
    id bigint NOT NULL,
    produkt_id bigint NULL,
    regal_id bigint NULL,
    mnozstvo_ks numeric NULL,
    updated_at timestamp with time zone NULL,
    poradie numeric NULL
);


-- TABUĽKA: inventury
CREATE TABLE IF NOT EXISTS public.inventury (
    id bigint NOT NULL,
    nazov text NOT NULL,
    stav text NULL,
    datum_vytvorenia timestamp with time zone NULL,
    datum_uzavretia timestamp with time zone NULL
);


-- TABUĽKA: inventura_polozky
CREATE TABLE IF NOT EXISTS public.inventura_polozky (
    id bigint NOT NULL,
    inventura_id bigint NULL,
    produkt_id bigint NULL,
    regal_id bigint NULL,
    mnozstvo numeric NOT NULL,
    created_at timestamp with time zone NULL,
    pouzivatel_id uuid NULL,
    pouzivatel_meno text NULL
);


-- TABUĽKA: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text NULL,
    role text NULL
);


-- TABUĽKA: zaznamy_inventury
CREATE TABLE IF NOT EXISTS public.zaznamy_inventury (
    id bigint NOT NULL,
    produkt_id bigint NULL,
    pouzivatel_id uuid NULL,
    stary_stav_ks numeric NULL,
    novy_stav_ks numeric NULL,
    rozdiel_ks numeric NULL,
    poznamka text NULL,
    vytvorene_at timestamp with time zone NULL
);


-- VIEW: skladova_zasoba_view
CREATE OR REPLACE VIEW public.skladova_zasoba_view AS
 SELECT sz.id,
    p.id AS produkt_id,
    p.nazov,
    p.ean,
    p.vlastne_id,
    p."Interne_id" AS interne_id,
    p.jednotka,
    p.balenie_ks,
    p.min_limit,
    k.nazov AS kategoria,
    k.id AS kategoria_id,
    st.nazov AS stredisko,
    p.stredisko_id,
    sz.regal_id,
    r.nazov AS regal_nazov,
    r.sklad_id,
    s.nazov AS sklad_nazov,
    COALESCE(sz.mnozstvo_ks, (0)::numeric) AS mnozstvo_ks,
    (COALESCE(sz.poradie, (0)::numeric))::integer AS poradie,
    sz.updated_at
   FROM (((((produkty p
     LEFT JOIN skladove_zasoby sz ON ((p.id = sz.produkt_id)))
     LEFT JOIN kategorie k ON ((p.kategoria_id = k.id)))
     LEFT JOIN strediska st ON ((p.stredisko_id = st.id)))
     LEFT JOIN regaly r ON ((sz.regal_id = r.id)))
     LEFT JOIN sklady s ON ((r.sklad_id = s.id)));


-- FUNCTION: unaccent
CREATE OR REPLACE FUNCTION public.unaccent(regdictionary, text)
 RETURNS text
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/unaccent', $function$unaccent_dict$function$
;


-- FUNCTION: unaccent
CREATE OR REPLACE FUNCTION public.unaccent(text)
 RETURNS text
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/unaccent', $function$unaccent_dict$function$
;


-- FUNCTION: unaccent_init
CREATE OR REPLACE FUNCTION public.unaccent_init(internal)
 RETURNS internal
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/unaccent', $function$unaccent_init$function$
;


-- FUNCTION: unaccent_lexize
CREATE OR REPLACE FUNCTION public.unaccent_lexize(internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/unaccent', $function$unaccent_lexize$function$
;


-- FUNCTION: set_limit
CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$
;


-- FUNCTION: show_limit
CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$
;


-- FUNCTION: show_trgm
CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$
;


-- FUNCTION: similarity
CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$
;


-- FUNCTION: similarity_op
CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$
;


-- FUNCTION: word_similarity
CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$
;


-- FUNCTION: word_similarity_op
CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$
;


-- FUNCTION: word_similarity_commutator_op
CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$
;


-- FUNCTION: similarity_dist
CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$
;


-- FUNCTION: word_similarity_dist_op
CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$
;


-- FUNCTION: word_similarity_dist_commutator_op
CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$
;


-- FUNCTION: gtrgm_in
CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$
;


-- FUNCTION: gtrgm_out
CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$
;


-- FUNCTION: gtrgm_consistent
CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$
;


-- FUNCTION: gtrgm_distance
CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$
;


-- FUNCTION: gtrgm_compress
CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$
;


-- FUNCTION: gtrgm_decompress
CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$
;


-- FUNCTION: gtrgm_penalty
CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$
;


-- FUNCTION: gtrgm_picksplit
CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$
;


-- FUNCTION: gtrgm_union
CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$
;


-- FUNCTION: gtrgm_same
CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$
;


-- FUNCTION: gin_extract_value_trgm
CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$
;


-- FUNCTION: gin_extract_query_trgm
CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$
;


-- FUNCTION: gin_trgm_consistent
CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$
;


-- FUNCTION: gin_trgm_triconsistent
CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$
;


-- FUNCTION: strict_word_similarity
CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$
;


-- FUNCTION: strict_word_similarity_op
CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$
;


-- FUNCTION: strict_word_similarity_commutator_op
CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$
;


-- FUNCTION: strict_word_similarity_dist_op
CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$
;


-- FUNCTION: strict_word_similarity_dist_commutator_op
CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$
;


-- FUNCTION: gtrgm_options
CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$
;


-- FUNCTION: get_kategorie_pre_regal
CREATE OR REPLACE FUNCTION public.get_kategorie_pre_regal(p_regal_id bigint)
 RETURNS TABLE(nazov text)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT k.nazov
  FROM skladove_zasoby sz
  JOIN produkty p ON sz.produkt_id = p.id
  LEFT JOIN kategorie k ON p.kategoria_id = k.id
  WHERE sz.regal_id = p_regal_id
  AND k.nazov IS NOT NULL
  ORDER BY k.nazov;
$function$
;


-- FUNCTION: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$function$
;


-- FUNCTION: get_zasoby_filtrovane
CREATE OR REPLACE FUNCTION public.get_zasoby_filtrovane(p_sklad_id bigint DEFAULT NULL::bigint, p_regal_id bigint DEFAULT NULL::bigint, p_kategoria text DEFAULT NULL::text, p_stredisko_id bigint DEFAULT NULL::bigint, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, produkt_id bigint, nazov text, ean text, vlastne_id text, interne_id text, jednotka text, kategoria text, stredisko text, regal_nazov text, sklad_nazov text, mnozstvo_ks numeric, min_limit integer, kategoria_id bigint, regal_id bigint, sklad_id bigint, poradie integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id, v.produkt_id, v.nazov, v.ean, v.vlastne_id, v.interne_id::text, v.jednotka, v.kategoria, 
    v.stredisko, v.regal_nazov, v.sklad_nazov, v.mnozstvo_ks, v.min_limit, 
    v.kategoria_id, v.regal_id, v.sklad_id, 
    
    -- !!! AJ TU PRE ISTOTU PRETYPUJEME !!!
    v.poradie::integer
    
  FROM skladova_zasoba_view v
  WHERE 
    (p_sklad_id IS NULL OR v.sklad_id = p_sklad_id)
    AND (p_regal_id IS NULL OR v.regal_id = p_regal_id)
    AND (p_kategoria IS NULL OR p_kategoria = 'vsetky' OR v.kategoria = p_kategoria)
    AND (p_stredisko_id IS NULL OR v.stredisko_id = p_stredisko_id)
    AND (p_search IS NULL OR p_search = '' OR 
         -- 🔥 OPRAVENÉ: Vyhľadávanie bez diakritiky a pridanie ID
         unaccent(v.nazov) ILIKE '%' || unaccent(p_search) || '%' OR 
         v.ean ILIKE '%' || p_search || '%' OR
         v.vlastne_id ILIKE '%' || p_search || '%' OR
         v.interne_id::text ILIKE '%' || p_search || '%' OR
         v.id::text ILIKE '%' || p_search || '%' OR
         v.produkt_id::text ILIKE '%' || p_search || '%')
  ORDER BY 
     v.poradie ASC, 
     v.nazov ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$
;


-- FUNCTION: get_inventura_prehlad
CREATE OR REPLACE FUNCTION public.get_inventura_prehlad(p_inventura_id bigint)
 RETURNS TABLE(produkt_id bigint, nazov text, ean text, regal_nazov text, kategoria_nazov text, system_mnozstvo numeric, spocitane_mnozstvo numeric, rozdiel numeric, je_hotove boolean)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id as produkt_id, p.nazov, p.ean, r.nazov as regal_nazov, k.nazov as kategoria_nazov,
    COALESCE(sz.mnozstvo_ks, 0) as system_mnozstvo, COALESCE(ip.mnozstvo, 0) as spocitane_mnozstvo,
    (COALESCE(ip.mnozstvo, 0) - COALESCE(sz.mnozstvo_ks, 0)) as rozdiel, (ip.id IS NOT NULL) as je_hotove
  FROM skladove_zasoby sz
  JOIN produkty p ON sz.produkt_id = p.id
  LEFT JOIN regaly r ON sz.regal_id = r.id
  LEFT JOIN kategorie k ON p.kategoria_id = k.id
  LEFT JOIN inventura_polozky ip 
    ON sz.produkt_id = ip.produkt_id 
    AND (sz.regal_id = ip.regal_id OR (sz.regal_id IS NULL AND ip.regal_id IS NULL))
    AND ip.inventura_id = p_inventura_id;
$function$
;


-- FUNCTION: uzavriet_inventuru
CREATE OR REPLACE FUNCTION public.uzavriet_inventuru(p_inventura_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO zaznamy_inventury (
    produkt_id, pouzivatel_id, stary_stav_ks, novy_stav_ks, rozdiel_ks, poznamka
  )
  SELECT 
    ip.produkt_id, ip.pouzivatel_id, COALESCE(sz.mnozstvo_ks, 0), ip.mnozstvo,
    (ip.mnozstvo - COALESCE(sz.mnozstvo_ks, 0)),
    'Uzavretie inventúry #' || p_inventura_id || CASE WHEN ip.pouzivatel_meno IS NOT NULL THEN ' (' || ip.pouzivatel_meno || ')' ELSE '' END
  FROM inventura_polozky ip
  LEFT JOIN skladove_zasoby sz ON sz.produkt_id = ip.produkt_id AND sz.regal_id = ip.regal_id
  WHERE ip.inventura_id = p_inventura_id AND ip.produkt_id IS NOT NULL; 

  UPDATE skladove_zasoby sz
  SET mnozstvo_ks = ip.mnozstvo, updated_at = now()
  FROM inventura_polozky ip
  WHERE sz.produkt_id = ip.produkt_id AND sz.regal_id = ip.regal_id AND ip.inventura_id = p_inventura_id AND ip.produkt_id IS NOT NULL;

  INSERT INTO skladove_zasoby (produkt_id, regal_id, mnozstvo_ks)
  SELECT ip.produkt_id, ip.regal_id, ip.mnozstvo
  FROM inventura_polozky ip
  WHERE ip.inventura_id = p_inventura_id AND ip.produkt_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM skladove_zasoby sz WHERE sz.produkt_id = ip.produkt_id AND sz.regal_id = ip.regal_id);

  UPDATE inventury SET stav = 'uzavreta', datum_uzavretia = now() WHERE id = p_inventura_id;
END;
$function$
;


-- FUNCTION: update_skladove_zasoby_poradie
CREATE OR REPLACE FUNCTION public.update_skladove_zasoby_poradie(payload json)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  item json;
BEGIN
  FOR item IN SELECT * FROM json_array_elements(payload)
  LOOP
    UPDATE public.skladove_zasoby
    SET poradie = (item->>'poradie')::integer,
        updated_at = now()
    WHERE id = (item->>'id')::bigint;
  END LOOP;
END;
$function$
;
