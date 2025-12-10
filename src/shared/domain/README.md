# Domain Types

Core TypeScript types for Grand Prix Universe. All rating attributes use a **0-100 scale**.

## ID Convention

All entities use **kebab-case string slugs** for IDs (e.g., `"phoenix-racing"`, `"max-speed"`). This makes JSON files human-readable and mod-friendly.

---

## Enums

### Department
Team departments that staff can belong to:
- `commercial` - Sponsor deals, hospitality, licensing
- `design` - Chassis design, technology R&D
- `mechanics` - Maintenance, repairs, pit crew

### StaffQuality
Skill tier for general staff (affects productivity and salary):
- `trainee` → `average` → `good` → `very-good` → `excellent`

### TyreCompound
Available tyre types for race assembly:
- `soft` - High grip, wears faster
- `medium` - Balanced grip and durability
- `hard` - Durable, less grip
- `intermediate` - Light rain conditions
- `wet` - Heavy rain conditions

See also `TyreCompoundConfig` for detailed compound properties (grip, durability, colors).

### DriverRole
A driver's position within the team:
- `first` - Primary driver, team orders favor them
- `second` - Secondary driver
- `equal` - No team orders between drivers
- `test` - Test driver only, doesn't race

### ChiefRole
Department head positions:
- `designer` - Chief Designer, leads Design department
- `mechanic` - Chief Mechanic, leads Mechanics
- `commercial` - Commercial Manager, leads Commercial

---

## Core Types

### Team
The central entity representing an F1 team.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug, e.g. `"phoenix-racing"` |
| `name` | string | Full team name |
| `shortName` | string | 3-letter abbreviation, e.g. `"PHX"` |
| `primaryColor` | string | Hex color for UI theming |
| `secondaryColor` | string | Secondary hex color |
| `headquarters` | string | Country/location |
| `budget` | number | Current balance in dollars |
| `factory` | Factory | Factory facilities and limits |

### Driver
A racing driver or test driver.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `nationality` | string | Country code, e.g. `"GB"`, `"DE"` |
| `dateOfBirth` | string | ISO date string |
| `teamId` | string \| null | Team ID, or null if free agent |
| `role` | DriverRole | Position within team |
| `attributes` | DriverAttributes | Performance attributes (see below) |
| `reputation` | number | 0-100, market value |
| `salary` | number | Per-season salary in dollars |
| `contractEnd` | number | Season number when contract expires |

#### DriverAttributes
All 0-100 scale. Higher is better.

| Attribute | Description |
|-----------|-------------|
| `pace` | 1-lap qualifying speed |
| `consistency` | Smaller gap between worst/best lap variation |
| `focus` | Ability to avoid mistakes (including terminal crashes) |
| `overtaking` | Overtake success rate relative to pace advantage |
| `wetWeather` | Performance in rain conditions |
| `smoothness` | Lower tyre/component wear per push level |
| `defending` | Defense success rate relative to pace disadvantage |

**Note:** `reputation` is separate from attributes. It's results-biased and recency-biased, representing market value independent of actual stats.

### Staff
General team personnel (non-chief, non-driver).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `department` | Department | Which department they work in |
| `quality` | StaffQuality | Skill tier |
| `teamId` | string \| null | Team ID, or null if available |
| `salary` | number | Per-season salary |
| `contractEnd` | number | Season when contract expires |

### Chief
Department head with significant impact on team performance.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `role` | ChiefRole | Which department they lead |
| `ability` | number | 0-100, critical to department output |
| `teamId` | string \| null | Team ID, or null if available |
| `salary` | number | Per-season salary |
| `contractEnd` | number | Season when contract expires |

---

## Technical Types

### Engine
Engine specification supplied by engine manufacturer.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Spec ID, e.g. `"phoenix-v10-01a"` |
| `manufacturerId` | string | Engine manufacturer ID |
| `name` | string | Display name |
| `fuelEfficiency` | number | 0-100, lower fuel consumption |
| `power` | number | 0-100, straight-line speed |
| `reliability` | number | 0-100, resistance to failure |
| `lightness` | number | 0-100, lighter = better performance |

### Tyre
Tyre specification by compound.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID |
| `manufacturerId` | string | Tyre manufacturer ID |
| `compound` | TyreCompound | Type of tyre |
| `grip` | number | 0-100, road holding |
| `durability` | number | 0-100, resistance to wear |
| `temperatureRange` | number | 0-100, optimal operating range width |

### Fuel
Fuel specification.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID |
| `manufacturerId` | string | Fuel manufacturer ID |
| `name` | string | Display name |
| `performance` | number | 0-100, combustion efficiency |
| `engineTolerance` | number | 0-100, compatibility across engine types |

### Car
A physical racing car owned by a team.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID |
| `teamId` | string | Owning team |
| `chassisId` | string | Reference to chassis design |
| `engineId` | string | Fitted engine spec |
| `condition` | number | 0-100, degrades with use/damage |
| `mileage` | number | Total miles driven |
| `isRaceCar` | boolean | `true` = race car, `false` = R&D car |

---

## Circuit Types

### Circuit
A racing track on the calendar.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug, e.g. `"monaco"` |
| `name` | string | Full name, e.g. `"Monte Carlo Street Circuit"` |
| `location` | string | City |
| `country` | string | Country |
| `lengthKm` | number | Lap length in kilometers |
| `laps` | number | Race distance in laps |
| `characteristics` | CircuitCharacteristics | Track properties |

### CircuitCharacteristics
All 0-100 scale.

| Field | Description |
|-------|-------------|
| `speedRating` | Average circuit speed |
| `downforceRequirement` | Aerodynamic needs |
| `brakingDemand` | Brake stress |
| `tyreWear` | Surface abrasiveness |
| `overtakingOpportunity` | Passing ease |
| `wetWeatherLikelihood` | Rain probability |
