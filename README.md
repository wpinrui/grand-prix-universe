# Grand Prix Universe

**A Formula One team management simulation inspired by Grand Prix World (1999)**

Manage every aspect of an F1 team: staff, finances, car development, sponsors, and race strategy. Build your legacy across an endless career as Team Principal.

## The Problem

Grand Prix World (1999) remains the gold standard for F1 management sims, but it's:
- Trapped on legacy Windows systems
- Locked to the 1998 F1 season
- Unable to be modded with modern F1 data due to licensing

## The Solution

Grand Prix Universe recreates the depth and feel of GPW with:
- **Modern tech stack** (Electron, React, Node.js)
- **Full modding support** via JSON configuration
- **Separation of real data** - distribute fictional content, users can add real F1 data
- **Endless career mode** - no 10-year limit
- **User team creation** - start from scratch or join an existing team

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Runtime | Electron |
| Backend | Node.js |
| Frontend | React + Tailwind CSS |
| State Sync | Electron IPC + React Query |
| Persistence | JSON files |
| Face Generation | Faces.js |

## Project Status

**Current Phase:** Phase 5 - Section UIs (in progress)

- ✅ Phase 0: Project Setup
- ✅ Phase 1: Core Data & Types
- ✅ Phase 2: Engine Abstractions
- ✅ Phase 3: Game Loop & State
- ✅ Phase 4: UI Shell (navigation, layout, theming)
- 🔄 Phase 5: Section UIs

### Screen Completion

**TEAM** (5/5)
- [x] Profile
- [x] Mail
- [x] Finance
- [x] Staff
- [x] Player Wiki

**WORLD** (5/5)
- [x] News
- [x] Teams
- [x] Drivers
- [x] Staff
- [x] Stats

**ENGINEERING** (3/6)
- [x] Cars
- [ ] Testing
- [x] Design (partial - 2/4 tabs)
- [ ] Construction
- [ ] Contracts
- [x] Factory

**COMMERCIAL** (0/4)
- [ ] Sponsors
- [ ] Deals
- [ ] Hospitality
- [ ] Licensing

**RACING** (0/4)
- [ ] Orders
- [ ] Car Set-Up
- [ ] Assembly
- [ ] Pit Lane

**FIA** (3/6)
- [x] Championship
- [x] Results
- [x] Races
- [ ] Ranking
- [ ] Regulations
- [ ] History

**OPTIONS** (4/4)
- [x] Saved Games
- [x] Game Options
- [x] Restart Game
- [x] Quit

See [agents/proposal.md](agents/proposal.md) for full design document.

## Key Features

- **Authentic GPW feel** - Same navigation structure, same depth
- **Modular engine architecture** - All simulation logic is swappable
- **JSON-configurable** - Points system, tyre compounds, circuits, and more
- **Dark theme** - Modern UI with team accent colors
- **Player Wiki** - Track your career legacy (like Football Manager's manager bio)

## Development

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for development guidelines.

### Quick Start

```bash
# Install dependencies
yarn install

# Run in development mode
yarn dev

# Build for production
yarn build
```

### Project Structure

```
/src
  /main          # Electron main process + game backend
  /renderer      # React frontend
  /shared        # Shared types and constants
/data
  /config        # Game rules (packaged)
  /content       # Fictional content (packaged)
  /override      # Real content (gitignored - for modding)
/saves           # Save files (gitignored)
```

### Documentation

- [agents/proposal.md](agents/proposal.md) - System design and architecture
- [.claude/CLAUDE.md](.claude/CLAUDE.md) - Development workflow

## Modding

Grand Prix Universe is designed for modding. The `/data/override/` directory can contain:
- `teams.json` - Real team names, colors, budgets
- `drivers.json` - Real driver names and stats
- `chiefs.json` - Real department chiefs (designers, engineers, etc.)
- `sponsors.json` - Real sponsor names
- `circuits.json` - Real circuit names and characteristics
- `manufacturers.json` - Real engine manufacturers

Files in `/override/` take priority over the default fictional content in `/content/`.

## License

TBD
