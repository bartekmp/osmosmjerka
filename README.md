<div align="cente## 📑 Table of Contents

- [About](#-about)
- [Key Features](#-key-features)
- [How to Play](#-how-to-play)
- [Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Cloud Deployment](#cloud-deployment)
  - [Development Mode](#development-mode)
- [Configuration](#️-configuration)
- [Data Management](#-data-management)
- [Admin Panel](#️-admin-panel)
- [HTTPS Support](#-https-support)
- [Contributing](#-contributing)
- [Roadmap](#️-roadmap)
- [License](#-license)c="frontend/public/android-chrome-192x192.png" alt="Osmosmjerka Logo" width="128" height="128">
  <h1>Osmosmjerka</h1>
  
  <p>A feature-rich web-based word search game with language learning capabilities</p>
  
  [![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
  [![React](https://img.shields.io/badge/React-19.1-61dafb?logo=react)](https://react.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.118-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql)](https://www.postgresql.org/)
  
  **[🎮 Live Demo](https://osmosmjerka.app/)** • Use `demo` / `demo` to login
  
</div>

---

## � Table of Contents

- [About](#-about)
- [Key Features](#-key-features)
- [How to Play](#-how-to-play)
- [Quick Start](#-quick-start)
- [Configuration](#️-configuration)
- [Data Management](#-data-management)
- [Admin Panel](#️-admin-panel)
- [HTTPS Support](#-https-support)
- [Contributing](#-contributing)
- [Roadmap](#️-roadmap)
- [License](#-license)

## �📖 About

[Osmosmjerka](https://hr.wikipedia.org/wiki/Osmosmjerka) (*Croatian for "eight-direction word search puzzle"*) is a modern, multilingual [word search game](https://en.wikipedia.org/wiki/Word_search) designed for language learners. Each puzzle is themed with categorized phrases that include translations, turning gameplay into an engaging [flashcard](https://en.wikipedia.org/wiki/Flashcard)-style learning experience.

**Tech Stack:** React • FastAPI • PostgreSQL

## ✨ Key Features

### Game Features
- 🎯 **Smart Puzzle Generation** - Intelligent algorithm creates challenging grids with maximized phrase intersections ([Algorithm Details](ALGORITHM.md))
- 🌍 **Multi-language Support** - Full i18n with English, Croatian, and Polish (easily extensible)
- 🎨 **Dark/Light Themes** - Comfortable viewing in any lighting condition
- 💾 **Auto-save Progress** - Resume your game exactly where you left off
- 📤 **Export Puzzles** - Download as DOCX or PNG for offline use
- 💡 **Progressive Hints** - Multi-level assistance system when you're stuck
- 📊 **Statistics & Scoring** - Track your performance and improvement over time
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile devices

### Admin Features
- 👥 **User Management** - Role-based access control (root admin, admin, user)
- 🗂️ **Language Sets** - Organize phrases into separate language collections
- 📝 **Phrase Database** - Comprehensive management with import/export and duplicate detection
- ⚡ **Batch Operations** - Bulk editing, category management, multi-select actions
- 🔄 **Data Import/Export** - Support for TXT and CSV file formats, plus copy-paste modal for quick additions
- 🔍 **Duplicate Management** - Automatic detection and prevention of duplicate phrases

## 🎮 How to Play

Find all phrases hidden in the grid! Phrases can appear in eight directions: horizontal, vertical, diagonal, and reversed. Click or swipe to select words, and watch as translations appear when you find them.

### Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/osmosmjerka-game.gif" alt="Gameplay"><br>
      <em>Finding phrases in action</em>
    </td>
    <td width="50%">
      <img src="docs/assets/osmosmjerka-new-round.png" alt="New Round"><br>
      <em>Starting a new puzzle</em>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/assets/osmosmjerka-won-round.png" alt="Victory"><br>
      <em>Puzzle completed with confetti!</em>
    </td>
    <td width="50%">
      <img src="docs/assets/osmosmjerka-nightmode.png" alt="Dark Mode"><br>
      <em>Dark theme for comfortable viewing</em>
    </td>
  </tr>
</table>

## 🚀 Quick Start

### Prerequisites
- Docker
- PostgreSQL database
- Node.js & npm (for development)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/bartekmp/osmosmjerka.git
cd osmosmjerka
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings (see Configuration section)
```

3. **Set up PostgreSQL**
   
   Deploy using the [example K8s YAML](/helpers/k8s-postgres.yaml) or use your existing instance. Create the database and user account, then update `POSTGRES_*` variables in `.env`.

4. **Build and run with Docker**
```bash
docker build -t osmosmjerka --build-arg VERSION=v1.33.0 .
docker run --rm -d -p 8085:8085 --name osmosmjerka osmosmjerka
```

5. **Access the application**
   
   Open `http://localhost:8085` in your browser.

### Cloud Deployment

Osmosmjerka is **cloud-ready** and can be deployed in various environments:

#### Standalone Container
Run as a single Docker container on any cloud platform (AWS ECS, Google Cloud Run, Azure Container Instances, etc.):

```bash
docker run -d -p 8085:8085 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD_HASH=<your_hash> \
  -e SECRET_KEY=<your_secret> \
  -e POSTGRES_HOST=<your_db_host> \
  -e POSTGRES_USER=<db_user> \
  -e POSTGRES_PASSWORD=<db_pass> \
  -e POSTGRES_DB=osmosmjerka \
  osmosmjerka:latest
```

#### Kubernetes Cluster
Deploy to Kubernetes using the provided example manifest:

```bash
# Review and customize the deployment
cp osmosmjerka-deployment.yaml.example osmosmjerka-deployment.yaml
# Edit with your configuration (secrets, resources, etc.)
vim osmosmjerka-deployment.yaml

# Deploy to your cluster
kubectl apply -f osmosmjerka-deployment.yaml
```

The example manifest includes:
- Deployment with configurable replicas
- Service definition
- ConfigMap for environment variables
- Secret management for sensitive data
- Health check probes
- Resource limits and requests

See [`osmosmjerka-deployment.yaml.example`](osmosmjerka-deployment.yaml.example) for the complete configuration template.

### Development Mode

For development with hot reload:

```bash
./start-dev-env-watch.sh
```

This starts:
- Frontend: `http://localhost:3000` (Vite dev server)
- Backend API: `http://localhost:8085`

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development setup and workflows.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Admin Credentials (required)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt_hash>  # See below for generation
SECRET_KEY=<your_secret_key>

# Database (required)
POSTGRES_USER=osmosmjerka
POSTGRES_PASSWORD=<db_password>
POSTGRES_DB=osmosmjerka
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Optional Settings
IGNORED_CATEGORIES=test debug  # Space-separated list
```

### Generate Admin Password Hash

Use this command to create a bcrypt password hash:

```bash
python3 -c "import bcrypt; import getpass; pwd=getpass.getpass('Password: ').encode(); print(bcrypt.hashpw(pwd, bcrypt.gensalt()).decode())"
```

## 📚 Data Management

### Import Phrases

The admin panel provides multiple ways to add phrases to your database:

#### File Upload
Upload phrases using TXT or CSV files via the admin panel (`/admin`):

**Format:** `phrase;translation;categories`

**Example:**
```
PYTHON;Programming language;Technology Programming
ALGORITHM;Step-by-step procedure;Computer Science
GRAMMAR;Language rules;Language Learning
```

#### Copy-Paste Modal
Prefer direct input? Use the copy-paste modal in the admin panel to paste blocks of phrases directly:
- No need to create files first
- Paste multiple lines at once
- Same format as file uploads: `phrase;translation;categories`
- Real-time validation before submission
- Ideal for quick additions or updates

#### Duplicate Management
Osmosmjerka automatically handles duplicates intelligently:
- **Automatic Detection** - Identifies duplicate phrases during import
- **Smart Prevention** - Prevents duplicate entries in the database (phrase field is the primary key)
- **Clear Reporting** - Shows which phrases were skipped due to duplication
- **Safe Imports** - You can re-import the same file without creating duplicates
- **Merge Support** - Update existing phrases by importing with the same phrase text

**Sample Data:** Check the `example/words.txt` file for Croatian-Polish phrases.

### Language Sets

Organize phrases into separate collections (e.g., Croatian-English, Spanish-French). Configure via the admin panel under "Language Sets Management".

![Language Set Management](docs/assets/osmosmjerka-language-set-mgmt.gif)

## 🛠️ Admin Panel

Access the admin panel at `/admin` with your configured admin credentials.

![Admin Dashboard](docs/assets/osmosmjerka-admin-view.png)

### User Roles

- **Root Administrator** - Full system access, user management, system settings
- **Administrative Users** - Database management, no user creation/deletion
- **Regular Users** - Game access only

### Features Overview

#### Phrase Database Management

![Database Management](docs/assets/osmosmjerka-admin.gif)

- **Browse & Search** - Advanced filtering, pagination, and search across phrases/translations
- **Inline Editing** - Edit phrases, translations, and categories directly
- **Batch Operations** - Multi-select for bulk delete and category management
- **File Import** - Support for TXT and CSV formats for uploading phrases into the database
- **Copy-Paste Modal** - Quick phrase addition by pasting blocks of text directly (no files needed)
- **Download** - Download the entire database or just filtered rows as a TXT file
- **Duplicate Detection** - Automatic identification and prevention of duplicate entries
- **Data Validation** - Real-time validation with clear error reporting

#### User Management

![User Management](docs/assets/osmosmjerka-user-mgmt.gif)

*Available to root administrators only*

- Create and manage user accounts
- Role assignment and permissions
- Password reset functionality
- User profile customization

#### Language Sets Management

![Language Sets](docs/assets/osmosmjerka-language-set-mgmt.gif)

Organize phrases into separate collections for different language pairs or themes:

- Create multiple language collections (e.g., Croatian-English, Spanish-French)
- Set default ignored categories per language set
- Bulk operations for moving phrases between sets
- Configure default language set for new users
- Export/import entire language sets

#### System Settings

![System Settings](docs/assets/osmosmjerka-system-settings.png)

*Root administrators only*

Global configuration for game features:
- **Progressive Hints** - Enable/disable multi-level hint system
- **Scoring System** - Toggle statistics tracking and performance metrics
- **User Overrides** - Allow individual users to override global settings

### Game Features

#### Progressive Hints

![Game Features](docs/assets/osmosmjerka-main-game-features.gif)

A multi-level assistance system that helps players solve challenging puzzles:
- First letter hints reveal starting characters
- Progressive disclosure maintains challenge balance
- Configurable globally or per-user
- Visual feedback in the grid

#### Scoring & Statistics

![Statistics Dashboard](docs/assets/osmosmjerka-stats-dashboard.gif)

Track and analyze player performance:
- Completion time and accuracy metrics
- Hint usage patterns
- Category-specific performance
- Game completion rates across difficulty levels

## 🔒 HTTPS Support

The API server ([uvicorn](https://www.uvicorn.org/)) supports SSL/TLS for secure connections.

### Using SSL Certificates

Store certificates in the `backend` directory and update the Docker `CMD`:

```bash
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "443", 
     "--ssl-keyfile=privkey.pem", "--ssl-certfile=fullchain.pem"]
```

### Generate Self-Signed Certificate (Development)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem -subj "/CN=localhost"
```

**Note:** Self-signed certificates will trigger browser warnings. For production, use certificates from [Let's Encrypt](https://letsencrypt.org/).

## 🤝 Contributing

Contributions are welcome! Please check out:
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup and workflows
- [ALGORITHM.md](ALGORITHM.md) - Grid generation algorithm details

### Adding New Languages

1. Create a new JSON file in `frontend/src/locales/`
2. Translate all entries based on existing language files
3. Register the language in `frontend/src/i18n.js`

## 🗺️ Roadmap

- [ ] Integration with [Anki](https://apps.ankiweb.net/) for spaced repetition learning
- [ ] Teacher mode - puzzles generated by the teacher to their students
- [ ] User-defined "learn this later" lists
- [ ] Learning curve tracking


## 📄 License

Licensed under [Apache License 2.0](LICENSE)

## 🙏 Acknowledgments

- Word search puzzle concept: Traditional [Osmosmjerka](https://hr.wikipedia.org/wiki/Osmosmjerka)
- Example Croatian-Polish phrase database included in `example/` folder

---

<div align="center">
  <p>Made with ❤️ for language learners</p>
  <p>
    <a href="https://github.com/bartekmp/osmosmjerka/issues">Report Bug</a> •
    <a href="https://github.com/bartekmp/osmosmjerka/issues">Request Feature</a>
  </p>
</div>
