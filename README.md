# osmosmjerka
[Osmosmjerka](https://hr.wikipedia.org/wiki/Osmosmjerka) is a simple web-based [word search](https://en.wikipedia.org/wiki/Word_search) game, with a little twist.
It uses words from the internal database, which are divided into separate categories, so each puzzle is having a certain theme.
Each word has to have the translation into the other language, so you can treat the game as something similar to [flashcard](https://en.wikipedia.org/wiki/Flashcard) language training.

## How it works
Osmosmjerka consists of three layers - a frontend app in [React](https://react.dev/), a [Flask](https://flask.palletsprojects.com/en/stable/)-based HTTP server and a [SQLite](https://sqlite.org/) database.
The web app communicates with the server, which pulls data from the database and returns it via HTTP requests to the frontend.
The database so far is expected to have a single table called `words`, which consists of three self-explaining columns `categories`, `word` and `translation`.
You need to provide your own sets of words, either by inserting them directly to the database (under `db/words.db` path) or use the *Upload Words* functionality in the web app. The supported file formats are `.txt` and `.csv`, and the expected single-line format is `<categories>;<word>;<translation>`.

## How to run
1. Pull the code and enter the main directory.
2. Create the `.env` file from the template:
```bash
cp .env.example .env
```
3. Set the variables in the `.env` file. 
The `ADMIN_` variables are used as the credentials to the administrator's page (the hash must be made with [bcrypt](https://github.com/pyca/bcrypt) - `hashpw`).
The ignored categories allows you to filter out entries of certain categories from your database you don't want to be used in the game.
2. Create the `db` directory, for the purpose of mounting it to the container.
3. Build the Docker image using:
```bash
docker build -t osmosmjerka .
```
4. Start the app, exposing the `8085` port and mounting the `db` directory:
```bash
docker run --rm -d -p 8085:8085 --name osmosmjerka -v ./db/:/app/db/ osmosmjerka
```
5. Access the app in your browser at `http://<the host ip>:8085`.

## Example words database
You might use my Croatian-Polish word database as an example placed in the `example` folder.

## Planned features and fixes
- Fixing obvious bugs (duh)
- Multi-language support
- Robust visual effects
- Integration with [Anki](https://apps.ankiweb.net/)
- Code quality improvements

# License
Osmosmjerka is licensed under Apache License 2.0.