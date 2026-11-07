# Regalía 🎁

A festive family Secret Santa app that works on phones. Family members don't need an account: each person gets their own personal link.

**Live:** https://regalia-xi.vercel.app

## What it does

- **Wish cards.** Everyone adds their shirt, pants and shoe sizes, plus up to 3 gift ideas. Saving the card plays a gift-wrap animation.
- **Spin the wheel.** After the names are drawn, each person drags or spins a prize wheel to find out who they're buying for. Then a gift box opens with confetti and a fanfare.
- **Fair, secret draw.** Names are drawn on the server. Nobody gets themselves, and even the organizer can't see who got who.
- **Organizer page** (`/#organizer`). Add family members, then send each person their link by WhatsApp or text. Set the budget and gift day, and draw names.
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
