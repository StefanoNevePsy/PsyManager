-- Migration 015: invio SMS interamente dal database (nessun terminale richiesto)
--
-- Perché questa migrazione esiste
-- --------------------------------
-- La migrazione 014 ha introdotto i promemoria SMS automatici appoggiandosi a
-- una Edge Function (supabase/functions/send-sms-reminders): funziona, ma per
-- attivarla serve la CLI di Supabase da terminale (deploy della funzione +
-- `supabase secrets set` per le credenziali del provider). Non tutti gli
-- utenti di PsyManager hanno un terminale a disposizione.
--
-- Questa migrazione sposta l'intero invio dentro PostgreSQL, usando due
-- estensioni Supabase-native:
--   * pg_cron — pianifica l'esecuzione periodica (nessun processo esterno)
--   * pg_net  — esegue la chiamata HTTP verso il provider SMS in modo
--               asincrono, senza bloccare il database
--
-- L'utente configura il proprio provider SMS ("qualsiasi provider REST a
-- singola chiamata") dalla pagina Impostazioni dell'app: URL dell'endpoint,
-- tipo di autenticazione, e un "modello" di corpo della richiesta con i
-- segnaposto {{to}}, {{text}}, {{sender}}. Nessun redeploy di codice è mai
-- necessario per cambiare provider.
--
-- IMPORTANTE — nulla parte finché:
--   1. l'utente salva le credenziali in Impostazioni (public.sms_credentials)
--   2. l'interruttore "Promemoria SMS automatici" è attivo
--      (reminder_settings.sms_enabled = true, già esistente dalla 014)
-- Finché queste due condizioni non sono entrambe vere, send_due_sms_reminders()
-- non trova nulla da processare per l'utente e non fa alcuna chiamata esterna.
--
-- Idempotente: eseguibile più volte senza effetti collaterali.

-- =============================================================================
-- 1. Estensioni (pg_cron, pg_net)
-- =============================================================================
-- Su alcuni progetti Supabase l'abilitazione di un'estensione richiede un
-- privilegio che l'utente collegato allo SQL Editor non ha sempre finché non
-- la attiva prima dal pannello Database > Extensions. Per questo ogni CREATE
-- EXTENSION è avvolto in un blocco che non fa fallire l'intero script: se
-- manca il privilegio, lo script stampa un avviso e prosegue. Chi legge
-- l'avviso può abilitare l'estensione dal Dashboard e rilanciare questo file
-- (è idempotente).
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_net/pg_cron: impossibile abilitare "pg_cron" automaticamente (%). '
    'Abilitala da Supabase Dashboard > Database > Extensions, poi rilancia questa migrazione.', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net/pg_cron: impossibile abilitare "pg_net" automaticamente (%). '
    'Abilitala da Supabase Dashboard > Database > Extensions, poi rilancia questa migrazione.', sqlerrm;
end $$;

-- =============================================================================
-- 2. Credenziali SMS — tabella SOLO SCRITTURA dal client
-- =============================================================================
-- Contiene il segreto del provider (password/API key/token). A differenza di
-- ogni altra tabella di PsyManager, qui NON esiste alcuna policy SELECT: la
-- riga si può creare e aggiornare ma mai più rileggere via API/client, nè da
-- parte dell'utente proprietario nè da chiunque altro. È una scelta
-- deliberata — vedi il commento sulla tabella più sotto.
create table if not exists public.sms_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  -- URL del singolo endpoint REST del provider (es. https://api.esempio.it/sms)
  endpoint_url text not null default '',
  auth_type text not null default 'basic',
  -- Basic: "auth_user" + "auth_secret" (utente/password o key/secret)
  -- Bearer: solo "auth_secret" (il token)
  -- None:   nessuna intestazione di autenticazione
  auth_user text default '',
  auth_secret text default '',
  body_format text not null default 'json',
  -- Corpo della richiesta del provider, con segnaposto {{to}} {{text}} {{sender}}.
  -- Per body_format='json' i segnaposto vanno dentro le virgolette JSON, es:
  --   {"to":"{{to}}","message":"{{text}}","from":"{{sender}}"}
  -- Per body_format='form' è una stringa key=value&key=value (vedi nota sul
  -- limite di pg_net più sotto, funzione public._build_sms_request).
  body_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vincoli con nome esplicito: un CHECK inline dentro un ADD COLUMN non
-- raggiungerebbe mai un database dove la colonna esiste già.
alter table public.sms_credentials
  drop constraint if exists sms_credentials_auth_type_chk;
alter table public.sms_credentials
  add constraint sms_credentials_auth_type_chk check (auth_type in ('basic', 'bearer', 'none'));
alter table public.sms_credentials
  drop constraint if exists sms_credentials_body_format_chk;
alter table public.sms_credentials
  add constraint sms_credentials_body_format_chk check (body_format in ('json', 'form'));

comment on table public.sms_credentials is
  'Credenziali del provider SMS (URL, autenticazione, modello del corpo). '
  'SOLO SCRITTURA dal client: esistono policy RLS per INSERT e UPDATE ma '
  'DELIBERATAMENTE nessuna per SELECT, quindi nessun ruolo applicativo (anon, '
  'authenticated) può mai rileggere endpoint_url/auth_user/auth_secret una '
  'volta salvati. La lettura, quando serve (invio SMS), avviene solo dentro '
  'funzioni SECURITY DEFINER di questo file, eseguite dal ruolo proprietario. '
  'Per mostrare all''utente "è configurato" senza esporre il segreto, usa '
  'la vista public.sms_credentials_status.';

alter table public.sms_credentials enable row level security;

drop policy if exists "Sms credentials insert own" on public.sms_credentials;
create policy "Sms credentials insert own" on public.sms_credentials
  for insert
  with check (auth.uid() = user_id);

-- NOTE: an UPDATE policy's USING clause is NOT defaulted from WITH CHECK
-- (only the reverse is true in Postgres) — omitting it here would default to
-- USING (true), letting the UPDATE command target any row before WITH CHECK
-- rejects the write. Both clauses are specified explicitly.
drop policy if exists "Sms credentials update own" on public.sms_credentials;
create policy "Sms credentials update own" on public.sms_credentials
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nessuna "create policy ... for select" qui: è intenzionale (vedi commento
-- sulla tabella). Difesa in profondità: anche a livello di GRANT togliamo
-- esplicitamente il SELECT ai ruoli applicativi, così la protezione non
-- dipende solo da RLS.
revoke select on public.sms_credentials from authenticated, anon;
grant insert, update on public.sms_credentials to authenticated;

drop trigger if exists sms_credentials_updated_at_trigger on public.sms_credentials;
create trigger sms_credentials_updated_at_trigger before update on public.sms_credentials
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- 3. Vista di stato — "è configurato?", mai il segreto
-- =============================================================================
-- NOTA SU security_invoker: la tabella sms_credentials non ha (di proposito)
-- alcuna policy SELECT, quindi una vista con security_invoker = true
-- erediterebbe quel divieto e restituirebbe SEMPRE zero righe a un utente
-- autenticato (RLS verrebbe valutata con i suoi permessi, che non includono
-- mai SELECT sulla tabella). Per restare utile la vista è quindi creata con
-- il comportamento predefinito (security_invoker = false): viene eseguita
-- con i permessi del proprietario della vista, che è owner anche della
-- tabella e quindi bypassa RLS per leggerla. La sicurezza per-utente non
-- viene quindi dalla RLS della tabella sottostante ma dal filtro esplicito
-- "where user_id = auth.uid()" qui sotto, che è l'unica barriera e per
-- questo è obbligatorio. La vista non espone MAI auth_user/auth_secret.
drop view if exists public.sms_credentials_status;
create view public.sms_credentials_status as
select
  sc.user_id,
  (sc.endpoint_url <> '') as configured,
  nullif(
    regexp_replace(sc.endpoint_url, '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+).*$', '\1'),
    sc.endpoint_url
  ) as endpoint_host,
  sc.auth_type,
  sc.body_format,
  sc.updated_at
from public.sms_credentials sc
where sc.user_id = auth.uid();

revoke all on public.sms_credentials_status from public, anon;
grant select on public.sms_credentials_status to authenticated;

-- =============================================================================
-- 4. Rendering del template SMS ({nome}, {giorno}, {ora}, ...)
-- =============================================================================
-- Porta in SQL la stessa logica di src/lib/whatsapp.ts::renderTemplate.
-- I nomi di giorni/mesi sono hardcoded (NON ci si affida a lc_time del
-- server, che su Supabase è tipicamente "C"/"en_US" e non garantito) e tutti
-- gli orari sono resi in Europe/Rome indipendentemente dal timezone di
-- sessione del chiamante (pg_cron esegue con il TimeZone di default del
-- database, che potrebbe non essere Europe/Rome).
drop function if exists public.render_sms_template(text, text, text, timestamptz, integer, text);
create function public.render_sms_template(
  p_template text,
  p_first_name text,
  p_last_name text,
  p_scheduled_at timestamptz,
  p_duration integer,
  p_service text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_local timestamp;
  v_dow integer;
  v_month integer;
  v_day integer;
  v_day_names text[] := array['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  v_month_names text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  v_giorno text;
  v_giorno_settimana text;
  v_data text;
  v_ora text;
  v_durata text;
  v_nome_completo text;
  v_out text;
begin
  if p_template is null then
    return '';
  end if;

  if p_scheduled_at is null then
    v_local := now() at time zone 'Europe/Rome';
  else
    v_local := p_scheduled_at at time zone 'Europe/Rome';
  end if;

  v_dow := extract(dow from v_local)::integer;   -- 0=domenica .. 6=sabato
  v_month := extract(month from v_local)::integer;
  v_day := extract(day from v_local)::integer;

  v_giorno_settimana := v_day_names[v_dow + 1];
  v_giorno := v_giorno_settimana || ' ' || v_day::text || ' ' || v_month_names[v_month];
  v_data := lpad(v_day::text, 2, '0') || '/' || lpad(v_month::text, 2, '0') || '/' || extract(year from v_local)::text;
  v_ora := lpad(extract(hour from v_local)::integer::text, 2, '0') || ':' || lpad(extract(minute from v_local)::integer::text, 2, '0');
  v_durata := coalesce(p_duration, 0)::text || ' minuti';
  v_nome_completo := trim(both ' ' from (coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')));

  -- Nessun segnaposto è prefisso di un altro fino alla parentesi graffa di
  -- chiusura (es. "{giorno}" non è una sottostringa di "{giorno_settimana}"),
  -- quindi l'ordine delle sostituzioni non ha effetti collaterali.
  v_out := p_template;
  v_out := replace(v_out, '{nome_completo}', v_nome_completo);
  v_out := replace(v_out, '{nome}', coalesce(p_first_name, ''));
  v_out := replace(v_out, '{cognome}', coalesce(p_last_name, ''));
  v_out := replace(v_out, '{giorno_settimana}', v_giorno_settimana);
  v_out := replace(v_out, '{giorno}', v_giorno);
  v_out := replace(v_out, '{data}', v_data);
  v_out := replace(v_out, '{ora}', v_ora);
  v_out := replace(v_out, '{durata}', v_durata);
  v_out := replace(v_out, '{prestazione}', coalesce(p_service, ''));

  return v_out;
end;
$$;

revoke all on function public.render_sms_template(text, text, text, timestamptz, integer, text) from public;

-- =============================================================================
-- 5. Normalizzazione numero italiano
-- =============================================================================
-- Porta esatta di src/lib/whatsapp.ts::normalizePhone in SQL.
drop function if exists public.normalize_phone_it(text);
create function public.normalize_phone_it(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  n text;
begin
  if p_raw is null then
    return null;
  end if;

  -- Tiene solo cifre e '+'
  n := regexp_replace(p_raw, '[^0-9+]', '', 'g');
  if n = '' then
    return null;
  end if;

  if left(n, 2) = '00' then
    n := '+' || substring(n from 3);
  end if;

  if left(n, 1) = '+' then
    n := substring(n from 2);
    return nullif(n, '');
  end if;

  -- Numero nazionale nudo: assume Italia
  if left(n, 2) = '39' and length(n) >= 11 then
    return n;
  end if;

  return '39' || n;
end;
$$;

revoke all on function public.normalize_phone_it(text) from public;

-- =============================================================================
-- 6. Helper interni (non esposti all'app)
-- =============================================================================

-- Escape di una stringa per l'inserimento dentro un valore JSON già tra
-- virgolette (es. "text":"{{text}}"). to_json() produce l'intera stringa
-- JSON già racchiusa e correttamente sfuggita fra virgolette; qui si tolgono
-- solo il primo e l'ultimo carattere (le virgolette di apertura/chiusura)
-- con substring per posizione — MAI con trim('"'), che rimuoverebbe anche
-- virgolette interne sfuggite se il testo termina con una virgoletta
-- letterale (es. testo che finisce con \").
drop function if exists public._json_escape(text);
create function public._json_escape(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select substring(
    to_json(coalesce(p_text, ''))::text
    from 2
    for length(to_json(coalesce(p_text, ''))::text) - 2
  );
$$;

revoke all on function public._json_escape(text) from public;

-- Costruisce body/params/headers per la chiamata HTTP al provider, a partire
-- dalle credenziali salvate e dal messaggio già renderizzato.
--
-- LIMITE NOTO DI pg_net: net.http_post(url, body jsonb, params jsonb,
-- headers jsonb, timeout_milliseconds) accetta SOLO un body di tipo jsonb —
-- non esiste (verificato sulla definizione SQL dell'estensione) alcun
-- overload con corpo testuale libero. pg_net serializza sempre `body` come
-- JSON. Questo significa che un vero corpo POST
-- "application/x-www-form-urlencoded" (stringa "a=1&b=2" grezza) NON è
-- raggiungibile da SQL con questa estensione.
-- Per body_format='json' non c'è alcun problema: il body è JSON per
-- natura e viene inviato così com'è.
-- Per body_format='form' si usa un compromesso esplicito (non un'accettazione
-- ottimistica): il body_template "chiave=valore&chiave=valore" viene
-- scomposto qui in singole coppie chiave/valore e inviato tramite il
-- parametro `params` di net.http_post, che pg_net stesso URL-encoda e
-- accoda come query string alla URL della richiesta (che resta comunque una
-- POST). Molti provider SMS "semplici" accettano le credenziali/il testo
-- anche come query string; per quelli che richiedono ESATTAMENTE un body
-- application/x-www-form-urlencoded, questa funzione non è sufficiente e va
-- usato body_format='json' se il provider lo supporta, oppure la vecchia
-- Edge Function (supabase/functions/send-sms-reminders).
drop function if exists public._build_sms_request(public.sms_credentials, text, text, text);
create function public._build_sms_request(
  p_cred public.sms_credentials,
  p_phone text,
  p_message text,
  p_sender text,
  out p_body jsonb,
  out p_params jsonb,
  out p_headers jsonb
)
language plpgsql
set search_path = public
as $$
declare
  v_auth_header text;
  v_pair text;
  v_key text;
  v_val text;
  v_eq_pos integer;
  v_text text;
begin
  if p_cred.auth_type = 'basic' then
    v_auth_header := 'Basic ' || encode(
      convert_to(coalesce(p_cred.auth_user, '') || ':' || coalesce(p_cred.auth_secret, ''), 'utf8'),
      'base64'
    );
  elsif p_cred.auth_type = 'bearer' then
    v_auth_header := 'Bearer ' || coalesce(p_cred.auth_secret, '');
  else
    v_auth_header := null;
  end if;

  p_headers := jsonb_build_object(
    'Content-Type',
    case when p_cred.body_format = 'json' then 'application/json' else 'application/x-www-form-urlencoded' end
  );
  if v_auth_header is not null then
    p_headers := p_headers || jsonb_build_object('Authorization', v_auth_header);
  end if;

  if p_cred.body_format = 'json' then
    v_text := coalesce(p_cred.body_template, '');
    v_text := replace(v_text, '{{to}}', public._json_escape(p_phone));
    v_text := replace(v_text, '{{text}}', public._json_escape(p_message));
    v_text := replace(v_text, '{{sender}}', public._json_escape(coalesce(p_sender, '')));
    -- Cast esplicito: se il modello salvato non produce JSON valido dopo la
    -- sostituzione, questo solleva un'eccezione (catturata dal chiamante e
    -- registrata come invio fallito) invece di inviare qualcosa di rotto.
    p_body := v_text::jsonb;
    p_params := '{}'::jsonb;
  else
    p_body := '{}'::jsonb;
    p_params := '{}'::jsonb;
    foreach v_pair in array regexp_split_to_array(coalesce(p_cred.body_template, ''), '&') loop
      if v_pair = '' then
        continue;
      end if;
      v_eq_pos := position('=' in v_pair);
      if v_eq_pos = 0 then
        v_key := v_pair;
        v_val := '';
      else
        v_key := substring(v_pair from 1 for v_eq_pos - 1);
        v_val := substring(v_pair from v_eq_pos + 1);
      end if;
      -- Valori grezzi (non URL-encodati qui): lo fa pg_net internamente
      -- quando costruisce la query string da `params`.
      v_val := replace(v_val, '{{to}}', coalesce(p_phone, ''));
      v_val := replace(v_val, '{{text}}', coalesce(p_message, ''));
      v_val := replace(v_val, '{{sender}}', coalesce(p_sender, ''));
      p_params := p_params || jsonb_build_object(v_key, v_val);
    end loop;
  end if;
end;
$$;

revoke all on function public._build_sms_request(public.sms_credentials, text, text, text) from public;

-- =============================================================================
-- 7. Invio dei promemoria dovuti
-- =============================================================================
alter table public.reminder_deliveries
  add column if not exists provider_request_id bigint;

create index if not exists reminder_deliveries_provider_request_id_idx
  on public.reminder_deliveries(provider_request_id)
  where provider_request_id is not null;

drop function if exists public.send_due_sms_reminders();
create function public.send_due_sms_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_now_hour integer;
  v_settings public.reminder_settings%rowtype;
  v_cred public.sms_credentials%rowtype;
  v_session record;
  v_window_end timestamptz;
  v_is_quiet boolean;
  v_first_session_id uuid;
  v_has_no_show boolean;
  v_message text;
  v_delivery_id uuid;
  v_built record;
  v_request_id bigint;
begin
  v_now_hour := extract(hour from (now() at time zone 'Europe/Rome'))::integer;

  for v_settings in
    select * from public.reminder_settings
    where sms_enabled = true
      and sms_rule <> 'manual'
  loop
    -- Serve una configurazione salvata e utilizzabile (endpoint non vuoto).
    select * into v_cred
    from public.sms_credentials
    where user_id = v_settings.user_id
      and endpoint_url <> '';

    if not found then
      continue;
    end if;

    v_window_end := now() + (v_settings.sms_advance_minutes || ' minutes')::interval;

    for v_session in
      select sub.*
      from (
        select
          s.id,
          s.user_id,
          s.patient_id,
          s.scheduled_at,
          s.duration_minutes,
          p.first_name,
          p.last_name,
          p.sms_consent,
          public.normalize_phone_it(p.phone) as phone_norm,
          st.name as service_name
        from public.sessions s
        join public.patients p on p.id = s.patient_id
        left join public.service_types st on st.id = s.service_type_id
        where s.user_id = v_settings.user_id
          and s.patient_id is not null
          and s.scheduled_at >= now()
          and s.scheduled_at <= v_window_end
          and s.status not in ('cancelled', 'no_show')
      ) sub
      where sub.sms_consent = true
        and sub.phone_norm is not null
    loop
      v_delivery_id := null;

      -- sms_rule: filtra QUALI sedute ricevono un SMS automatico.
      if v_settings.sms_rule = 'first' then
        select s2.id into v_first_session_id
        from public.sessions s2
        where s2.user_id = v_settings.user_id
          and s2.patient_id = v_session.patient_id
          and s2.status not in ('cancelled', 'no_show')
        order by s2.scheduled_at asc
        limit 1;

        if v_first_session_id is distinct from v_session.id then
          v_skipped := v_skipped + 1;
          continue;
        end if;
      elsif v_settings.sms_rule = 'no_show' then
        select exists(
          select 1 from public.sessions s3
          where s3.user_id = v_settings.user_id
            and s3.patient_id = v_session.patient_id
            and s3.status = 'no_show'
            and s3.scheduled_at < now()
        ) into v_has_no_show;

        if not v_has_no_show then
          v_skipped := v_skipped + 1;
          continue;
        end if;
      end if;
      -- 'all' non richiede controlli aggiuntivi.

      -- Fascia di silenzio: [quiet_start, quiet_end), con wraparound su
      -- mezzanotte; quiet_start = quiet_end significa "nessuna fascia".
      -- Nessuna riga di delivery viene scritta qui, così un run successivo
      -- (ancora dentro la finestra di invio) ritenta senza bisogno di sblocco.
      v_is_quiet := case
        when v_settings.sms_quiet_start = v_settings.sms_quiet_end then false
        when v_settings.sms_quiet_start < v_settings.sms_quiet_end then
          v_now_hour >= v_settings.sms_quiet_start and v_now_hour < v_settings.sms_quiet_end
        else
          v_now_hour >= v_settings.sms_quiet_start or v_now_hour < v_settings.sms_quiet_end
      end;

      if v_is_quiet then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      begin
        -- Claim: l'INSERT con ON CONFLICT DO NOTHING è il vero lock. Se un
        -- altro run parallelo ha già rivendicato questa (sessione, canale),
        -- non torna alcuna riga e ci si ferma senza inviare due volte.
        insert into public.reminder_deliveries
          (user_id, session_id, channel, status, recipient, provider, scheduled_for)
        values
          (v_settings.user_id, v_session.id, 'sms', 'pending', v_session.phone_norm, 'db-cron', v_session.scheduled_at)
        on conflict (session_id, channel) do nothing
        returning id into v_delivery_id;

        if v_delivery_id is null then
          v_skipped := v_skipped + 1;
        else
          v_claimed := v_claimed + 1;

          v_message := public.render_sms_template(
            v_settings.sms_template,
            v_session.first_name,
            v_session.last_name,
            v_session.scheduled_at,
            v_session.duration_minutes,
            v_session.service_name
          );

          select * into v_built
          from public._build_sms_request(v_cred, v_session.phone_norm, v_message, v_settings.sms_sender);

          v_request_id := net.http_post(
            url := v_cred.endpoint_url,
            body := v_built.p_body,
            params := v_built.p_params,
            headers := v_built.p_headers
          );

          update public.reminder_deliveries
          set provider_request_id = v_request_id
          where id = v_delivery_id;

          update public.sessions
          set reminder_sent_at = now()
          where id = v_session.id;
        end if;
      exception when others then
        -- Un fallimento su una singola seduta non deve mai interrompere il
        -- giro sulle altre. Se il claim era già avvenuto, la riga di delivery
        -- viene marcata 'failed' con il motivo; altrimenti si conta e basta.
        v_failed := v_failed + 1;
        if v_delivery_id is not null then
          update public.reminder_deliveries
          set status = 'failed', error = left(sqlerrm, 2000)
          where id = v_delivery_id;
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;

revoke all on function public.send_due_sms_reminders() from public;

-- =============================================================================
-- 8. Riconciliazione delle risposte asincrone di pg_net
-- =============================================================================
-- net.http_post è asincrono: restituisce subito un id di richiesta (bigint) e
-- la risposta arriva più tardi in net._http_response. Questa funzione chiude
-- il cerchio: legge le risposte arrivate e aggiorna reminder_deliveries.
drop function if exists public.reconcile_sms_deliveries();
create function public.reconcile_sms_deliveries()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
  v_row record;
  v_status_code integer;
  v_body text;
  v_error_msg text;
  v_found boolean;
  v_message_id text;
begin
  for v_row in
    select id, created_at, provider_request_id
    from public.reminder_deliveries
    where status = 'pending' and provider_request_id is not null
  loop
    v_found := false;

    select r.status_code, r.content, r.error_msg
    into v_status_code, v_body, v_error_msg
    from net._http_response r
    where r.id = v_row.provider_request_id;

    if found then
      v_found := true;
    end if;

    if not v_found then
      -- Nessuna risposta ancora (o già scaduta dalla tabella interna di
      -- pg_net, che la conserva solo per alcune ore): dopo 30 minuti senza
      -- risposta si considera persa la richiesta.
      if v_row.created_at < now() - interval '30 minutes' then
        update public.reminder_deliveries
        set status = 'failed', error = 'timeout'
        where id = v_row.id;
        v_failed := v_failed + 1;
      else
        v_pending := v_pending + 1;
      end if;
      continue;
    end if;

    if v_error_msg is not null then
      -- Errore a livello di rete/pg_net (DNS, connessione rifiutata, ecc.),
      -- non un errore HTTP del provider.
      update public.reminder_deliveries
      set status = 'failed', error = left(v_error_msg, 500)
      where id = v_row.id;
      v_failed := v_failed + 1;
    elsif v_status_code between 200 and 299 then
      v_message_id := null;
      begin
        v_message_id := coalesce(
          v_body::jsonb ->> 'id',
          v_body::jsonb ->> 'message_id',
          v_body::jsonb ->> 'order_id'
        );
      exception when others then
        -- Risposta 2xx ma corpo non-JSON o senza un campo id riconosciuto:
        -- l'invio resta comunque un successo, semplicemente senza id da
        -- riconciliare in futuro.
        v_message_id := null;
      end;

      update public.reminder_deliveries
      set status = 'sent', sent_at = now(), provider_message_id = v_message_id
      where id = v_row.id;
      v_sent := v_sent + 1;
    else
      update public.reminder_deliveries
      set status = 'failed', error = left(coalesce(v_body, ''), 500)
      where id = v_row.id;
      v_failed := v_failed + 1;
    end if;
  end loop;

  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'pending', v_pending);
end;
$$;

revoke all on function public.reconcile_sms_deliveries() from public;

-- =============================================================================
-- 9. Invio di prova (manuale, dall'app)
-- =============================================================================
-- A differenza delle funzioni sopra, questa è pensata per essere chiamata
-- direttamente dal client via RPC per un pulsante "Invia SMS di prova" in
-- Impostazioni. Nonostante sia SECURITY DEFINER (deve poter leggere le
-- proprie credenziali dalla tabella write-only), agisce ESCLUSIVAMENTE per
-- auth.uid(): non accetta uno user_id come parametro e non tocca mai
-- reminder_deliveries.
drop function if exists public.send_test_sms(text);
create function public.send_test_sms(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cred public.sms_credentials%rowtype;
  v_phone text;
  v_sender text;
  v_built record;
  v_request_id bigint;
begin
  if v_uid is null then
    raise exception 'send_test_sms richiede un utente autenticato';
  end if;

  select * into v_cred from public.sms_credentials where user_id = v_uid;
  if not found or v_cred.endpoint_url = '' then
    raise exception 'Nessuna configurazione SMS salvata: apri Impostazioni e configura il provider prima di inviare un test.';
  end if;

  v_phone := public.normalize_phone_it(p_phone);
  if v_phone is null then
    raise exception 'Numero di telefono non valido: %', coalesce(p_phone, '(vuoto)');
  end if;

  select coalesce(sms_sender, '') into v_sender
  from public.reminder_settings
  where user_id = v_uid;

  select * into v_built
  from public._build_sms_request(v_cred, v_phone, 'PsyManager: messaggio di prova.', coalesce(v_sender, ''));

  v_request_id := net.http_post(
    url := v_cred.endpoint_url,
    body := v_built.p_body,
    params := v_built.p_params,
    headers := v_built.p_headers
  );

  return jsonb_build_object('ok', true, 'request_id', v_request_id);
end;
$$;

revoke all on function public.send_test_sms(text) from public;
grant execute on function public.send_test_sms(text) to authenticated;

-- =============================================================================
-- 10. Pianificazione (pg_cron)
-- =============================================================================
-- Ogni job è avvolto in un blocco difensivo che: (a) rimuove prima un job
-- omonimo già pianificato (rieseguire questa migrazione non duplica nulla),
-- (b) non fa fallire l'intera migrazione se pg_cron non è ancora abilitato
-- (sezione 1) — in quel caso stampa solo un avviso.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'psymanager-send-sms';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'psymanager-send-sms',
    '*/15 * * * *',
    $cron$select public.send_due_sms_reminders();$cron$
  );
exception when others then
  raise notice 'psymanager-send-sms: impossibile pianificare il job pg_cron (%). '
    'Abilita l''estensione pg_cron (sezione 1) e rilancia questa migrazione.', sqlerrm;
end $$;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'psymanager-reconcile-sms';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'psymanager-reconcile-sms',
    '*/5 * * * *',
    $cron$select public.reconcile_sms_deliveries();$cron$
  );
exception when others then
  raise notice 'psymanager-reconcile-sms: impossibile pianificare il job pg_cron (%). '
    'Abilita l''estensione pg_cron (sezione 1) e rilancia questa migrazione.', sqlerrm;
end $$;
