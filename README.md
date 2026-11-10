# Regalía 🎁

A festive family Secret Santa app that works on phones. Family members don't need an account: each person gets their own personal link.

**Live:** https://regalia-xi.vercel.app

## What it does

- **Wish cards.** Everyone adds their shirt, pants and shoe sizes, plus up to 3 gift ideas. Saving the card plays a gift-wrap animation.
- **Spin the wheel.** After the names are drawn, each person drags or spins a prize wheel to find out who they're buying for. Then a gift box opens with confetti and a fanfare.
- **Fair, secret draw.** Names are drawn on the server. Nobody gets themselves, and even the organizer can't see who got who.
- **Organizer page** (`/#organizer`). Add family members, then send each person their link by WhatsApp or text. Set the budget and gift day, and draw names.
- **More than one family.** One site can run separate exchanges, for example each side of the family. Each family has its own list, organizer code, budget, gift day and draw (see below).
- **English / Español** with one tap (🌐 Traducir).
- **Festive touches.** A countdown to gift day, twinkling lights, snow, optional Christmas music and sound effects.
- **Installs like an app.** It can be added to the home screen, with its own icon.

## How it's built

- Plain HTML, CSS and JavaScript, with no build step (`index.html`, `style.css`, `app.js`, `fx.js`, `i18n.js`).
- [Supabase](https://supabase.com) (Postgres) stores the data. The tables are locked, and the site can only use the functions in `schema.sql`.
- Hosted on [Vercel](https://vercel.com) as a static site.

## Run your own copy

1. Create a Supabase project. Open the SQL Editor and run [`schema.sql`](schema.sql).
2. Put your project URL and its public `anon` key in [`config.js`](config.js).
3. Deploy the folder to any static host, such as Vercel or Netlify.
4. Open `/#organizer`, choose an organizer code, and add your family.

The `anon` key in `config.js` is meant to be public. The database only allows the Regalía functions, never direct table access.

## Add another family

Each family gets its own organizer page. Pick a short name (lowercase letters, numbers or dashes) and open:

- `/#organizer`: the original family (unchanged)
- `/#organizer=garcia`: a separate family called "garcia"

The first time you open a new family's organizer page, it asks you to choose an organizer code for that family. Then add people and send them their links, just like before. Personal links already know which family they belong to, and nobody in one family sees the other family's names, wish cards or matches. One person can be in both families; they just get two different links.

If your database was set up before families existed, run [`schema.sql`](schema.sql) again in the Supabase SQL Editor once. Nothing is lost: everyone already there stays in the original family.
