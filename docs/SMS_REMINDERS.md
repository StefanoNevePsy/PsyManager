# Promemoria SMS — guida alla configurazione

## Due modi per attivarli

**A. Dal database (consigliato — nessun terminale)**
L'invio è già incluso in `supabase-setup.sql`: quando esegui quel file vengono
create anche le funzioni di invio e la pianificazione automatica. Ti restano
solo due cose, entrambe dall'app:

1. **Impostazioni → Credenziali provider SMS**: scegli il provider dal menu
   (SMSHosting, Aruba, Twilio o "Altro"), incolla le due credenziali e salva.
2. Premi **"Invia SMS di prova"** con il tuo numero. Se arriva, hai finito.
3. **Impostazioni → Promemoria SMS automatici**: accendi l'interruttore,
   scegli anticipo, regola di invio e ore di silenzio.
4. Sulla scheda di ogni paziente, spunta **Consenso SMS**.

Nota: `pg_cron` e `pg_net` devono essere attive sul progetto Supabase
(Database → Extensions). Se lo script segnala che non ha potuto attivarle,
abilitale da lì e riesegui il file — il resto rimane invariato.

**B. Con la funzione server (alternativa avanzata)**
Serve solo se usi Skebby, che richiede due chiamate concatenate (login e poi
invio) mal gestibili dal database. Richiede il terminale e la CLI di
Supabase: le istruzioni sono più avanti in questo documento.

## Quale provider scegliere

**SMSHosting** è il consiglio predefinito per l'Italia: API a chiamata
singola (ideale per l'invio dal database), registrazione del mittente gestita
da loro, crediti prepagati senza canone, circa 4-5 centesimi a SMS.
**Aruba SMS** è equivalente e comodo se hai già altri servizi Aruba.
**Twilio** è il più solido ma costa di più per l'Italia.
**Skebby** è ottimo ma richiede il metodo B.

Evita i rivenditori molto economici senza rotte certificate: per promemoria
clinici la consegna deve essere affidabile.

## Come funziona (in breve)

Ogni tot minuti uno "scheduler" esterno chiama la funzione
`send-sms-reminders`. La funzione:

1. Guarda quali utenti hanno attivato gli SMS nelle impostazioni.
2. Per ognuno, cerca gli appuntamenti che iniziano entro il "preavviso"
   configurato (es. entro le prossime 24 ore).
3. Esclude appuntamenti annullati, di gruppo (serve un numero di telefono
   singolo), pazienti senza consenso SMS o senza telefono valido, e
   appuntamenti per cui l'SMS è già stato inviato.
4. Rispetta le fasce orarie di silenzio (es. non manda SMS di notte): se
   siamo dentro la fascia di silenzio, l'invio slitta al giro successivo,
   nessun messaggio viene perso.
5. Invia l'SMS tramite il provider scelto e registra l'esito.

Ogni combinazione appuntamento+SMS viene inviata **una sola volta**, anche se
la funzione gira più volte in parallelo (c'è un vincolo di unicità nel
database a garanzia).

---

## Passo 1 — Scegli un provider SMS e registra il mittente

La funzione supporta tre provider, scelti dal menu "Provider SMS" nelle
impostazioni dell'app:

| Provider | Note |
|---|---|
| **Skebby** (consigliato per l'Italia) | Gateway italiano, pagamento a crediti prepagati, buon supporto per mittenti alfanumerici. |
| **Twilio** | Gateway internazionale, richiede numero mittente o registrazione del mittente alfanumerico per l'Italia. |
| **Generic** | Un webhook generico verso qualsiasi altro provider italiano che tu voglia usare (vedi sotto). |

Passaggi:

1. Crea un account sul provider scelto e **acquista crediti prepagati** (gli
   SMS non sono gratuiti: ogni messaggio consuma credito).
2. **Registra il mittente alfanumerico** (es. "StudioRossi", massimo 11
   caratteri, senza spazi) — è il nome che il paziente vede al posto di un
   numero di telefono. **In Italia questa registrazione è obbligatoria per
   legge** (delibera AGCOM sui mittenti SMS) **e richiede alcuni giorni**
   lavorativi: fallo con largo anticipo prima di attivare i promemoria.
3. Annota le credenziali API (utente/password per Skebby, Account SID/Auth
   Token per Twilio): ti servono al passo 2.

---

## Passo 2 — Distribuisci la funzione e configura i secrets

Da terminale, nella cartella del progetto, con la [Supabase CLI](https://supabase.com/docs/guides/cli) già collegata al tuo progetto (`supabase link`):

```bash
# Distribuisci la funzione. --no-verify-jwt perché l'accesso è protetto da
# un secret custom (x-cron-secret), non da un login utente Supabase: la
# funzione è pensata per essere chiamata solo dallo scheduler, mai dal browser.
supabase functions deploy send-sms-reminders --no-verify-jwt
```

Poi imposta i secrets (sostituisci i valori con i tuoi):

```bash
# Sempre richiesto: il "lucchetto" che protegge l'endpoint dallo scheduler
supabase secrets set CRON_SECRET="genera-una-stringa-lunga-e-casuale-qui"

# Se usi Skebby
supabase secrets set SKEBBY_USERNAME="il-tuo-username-skebby" SKEBBY_PASSWORD="la-tua-password-skebby"

# Se usi Twilio (in alternativa a Skebby)
supabase secrets set TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" TWILIO_AUTH_TOKEN="il-tuo-auth-token"

# Se usi il provider "generic" (in alternativa agli altri due)
supabase secrets set SMS_WEBHOOK_URL="https://il-tuo-provider.esempio.it/invia-sms" SMS_WEBHOOK_TOKEN="token-opzionale-bearer"
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili
automaticamente dentro ogni Edge Function: non serve impostarli a mano.

Per generare una stringa casuale robusta per `CRON_SECRET`:

```bash
openssl rand -hex 32
```

---

## Passo 3 — Pianifica l'esecuzione automatica

La funzione da sola non fa nulla se nessuno la chiama: serve uno "scheduler"
che la invochi periodicamente (consigliato: **ogni 15 minuti**). Scegli **una
sola** delle due opzioni seguenti.

### Opzione A — pg_cron + pg_net (dentro Supabase, consigliata)

Nel **SQL Editor** di Supabase, esegui (sostituisci `IL-TUO-PROJECT-REF` e il
`CRON_SECRET` con i tuoi valori — quest'ultimo deve essere identico a quello
impostato al Passo 2):

```sql
-- Estensioni necessarie (idempotente, sicuro da rieseguire)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Rimuove un eventuale job precedente con lo stesso nome, poi lo ricrea
select cron.unschedule('send-sms-reminders')
where exists (select 1 from cron.job where jobname = 'send-sms-reminders');

select cron.schedule(
  'send-sms-reminders',
  '*/15 * * * *', -- ogni 15 minuti
  $$
  select net.http_post(
    url := 'https://IL-TUO-PROJECT-REF.supabase.co/functions/v1/send-sms-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'IL-TUO-CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Per verificare che il job sia attivo: `select * from cron.job;`
Per vedere gli esiti delle ultime chiamate: `select * from cron.job_run_details order by start_time desc limit 20;`

### Opzione B — GitHub Actions (alternativa, se preferisci non usare pg_cron)

Crea `.github/workflows/sms-reminders.yml` nel repository:

```yaml
name: Invia promemoria SMS

on:
  schedule:
    - cron: '*/15 * * * *' # ogni 15 minuti
  workflow_dispatch: {} # permette anche l'avvio manuale da tab "Actions"

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Chiama la Edge Function
        run: |
          curl --fail --silent --show-error \
            -X POST \
            -H "Content-Type: application/json" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            -d '{}' \
            "https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/send-sms-reminders"
```

Poi in **GitHub → Settings → Secrets and variables → Actions** aggiungi:
- `CRON_SECRET`: identico al valore impostato al Passo 2
- `SUPABASE_PROJECT_REF`: il riferimento del tuo progetto Supabase (es. `abcdefghijklmnop`)

Nota: i cron di GitHub Actions non sono garantiti al minuto esatto (possono
slittare di qualche minuto in caso di carico sulla piattaforma); per un
orario più preciso preferisci l'Opzione A.

---

## Passo 4 — Attiva tutto nell'app e registra il consenso

1. Vai in **Impostazioni → Promemoria** e attiva "Promemoria SMS".
2. Scegli provider, mittente (deve combaciare esattamente con quello
   registrato al Passo 1), preavviso, fascia di silenzio e regola di invio
   (tutti gli appuntamenti / solo il primo / solo dopo un'assenza / manuale).
3. **Per ogni paziente**, attiva il consenso SMS nella sua scheda anagrafica
   prima che parta qualunque messaggio: **senza consenso registrato, quel
   paziente non riceve SMS automatici**, qualunque sia la regola scelta —
   è un controllo di sicurezza indipendente, non un'impostazione globale.

---

## Risoluzione problemi

### "Non ho ricevuto nessun SMS, come capisco cosa è successo?"

Nel SQL Editor di Supabase:

```sql
select
  rd.created_at,
  rd.status,
  rd.recipient,
  rd.error,
  rd.provider,
  s.scheduled_at
from reminder_deliveries rd
join sessions s on s.id = rd.session_id
where rd.channel = 'sms'
order by rd.created_at desc
limit 50;
```

- `status = 'pending'` da più di qualche minuto: probabile che l'invio sia
  fallito a metà (es. la funzione è andata in timeout) — verifica i log della
  funzione (`supabase functions logs send-sms-reminders`).
- `status = 'failed'`: leggi la colonna `error`, che riporta il messaggio
  esatto restituito dal provider (credenziali sbagliate, credito
  esaurito, mittente non registrato, numero non valido, ecc.).
- Nessuna riga per un appuntamento che ti aspettavi: controlla, in ordine —
  consenso SMS del paziente, numero di telefono presente e valido, che
  l'appuntamento non sia di gruppo, che non sia troppo lontano nel tempo
  rispetto al "preavviso" configurato, e che l'orario attuale non sia dentro
  la fascia di silenzio.

### Come faccio un invio di prova con un solo messaggio?

Il modo più sicuro è isolare un solo appuntamento di prova:

1. Crea un paziente di test con il tuo numero di telefono, attiva il suo
   consenso SMS.
2. Fissagli un appuntamento che cada entro la finestra di preavviso (es. tra
   10 minuti se il preavviso è 1440 minuti, l'appuntamento andrà comunque
   trovato dalla prossima esecuzione pianificata; per un test immediato,
   crealo circa nel preavviso configurato in modo che rientri subito nella
   finestra).
3. Invoca la funzione manualmente, senza aspettare il cron:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: IL-TUO-CRON_SECRET" \
  -d '{}' \
  "https://IL-TUO-PROJECT-REF.supabase.co/functions/v1/send-sms-reminders"
```

La risposta è un JSON tipo `{"processed":1,"sent":1,"failed":0,"skipped":0}`.
Controlla poi `reminder_deliveries` come sopra per l'esito dettagliato.

4. Elimina il paziente/appuntamento di test una volta verificato tutto.

---

## Nota GDPR

- Il provider SMS (Skebby, Twilio o altro) tratta i dati per tuo conto:
  **è un responsabile del trattamento** ai sensi dell'art. 28 GDPR — firma
  il relativo Data Processing Agreement (DPA) offerto dal provider prima di
  inviare il primo messaggio reale.
- **Non mettere contenuti clinici nel testo del messaggio.** Il template di
  default ("Le ricordo l'appuntamento di...") è già pensato per restare
  neutro: evita di aggiungere diagnosi, tipo di terapia o altri dettagli
  sensibili nei placeholder liberi o nelle modifiche al testo.
- Il consenso all'invio SMS è **per singolo paziente**, non un interruttore
  globale: attivalo solo per chi ha effettivamente acconsentito a ricevere
  promemoria via SMS, e disattivalo se il paziente revoca il consenso.
