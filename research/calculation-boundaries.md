# Trustworthy automotive calculation boundaries

Status: decision note, 2026-08-31

## Decision

The MVP is a transparent calculator and evidence checker, not a component-selection authority. It may normalize units, evaluate the formulas below, and screen a user-selected part against explicit manufacturer or vehicle limits. It must not invent an ampacity, fuse rating, hose size, thermostat position, fluid property, tolerance, or safety factor. Missing or inapplicable inputs produce `unknown`, not a default.

The electrical envelope is steady-state, low-voltage DC in surface vehicles, at no more than 60 V DC. That matches the scope of current [SAE J1128](https://saemobilus.sae.org/standards/j1128_202508-low-voltage-primary-cable) and the low-voltage copper-cable scope of [ISO 19642-3](https://www.iso.org/standard/66301.html). High-voltage, AC, and safety certification are deferred.

Four result verbs keep the boundary visible:

- `calculate`: all required inputs and an applicable formula exist.
- `screen`: compare a selected candidate with sourced limits; do not claim final suitability.
- `user-entered`: the owner supplied a value the system cannot derive.
- `unknown`: evidence is missing, conflicting, outside the envelope, or cannot establish actual state.

## Trust contract

Every numeric input retains its semantic quantity, original value and unit, SI-normalized value, operating condition, uncertainty or bounds, and provenance. Provenance includes source kind, URL or document identifier, revision/date, page or table, product/vehicle applicability, and measurement timestamp where applicable. Every result retains the formula identifier and revision, input identifiers, assumptions, applicability envelope, result unit, and calculation timestamp.

Unit conversion does not erase input uncertainty. Exact Celsius, kelvin, and Fahrenheit conversions are published by [NIST](https://www.nist.gov/pml/owm/si-units-temperature); exact conversion adds no uncertainty, while the source value keeps its own uncertainty. The MVP propagates supplied lower/upper bounds through monotonic formulas and labels the result `input-bound envelope`, not a confidence interval. It never invents a percentage. Statistical uncertainty propagation is deferred unless input distributions, correlations, and the measurement model are available; those are required by the [JCGM Guide to the Expression of Uncertainty in Measurement](https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf). Model-form uncertainty is separate and may remain unknown.

## Electrical calculations

### Current and load scenarios

The MVP can calculate:

- `I = V / R` from voltage and resistance for a stated steady DC operating point.
- `I = P / V` only when `P` is electrical input power at that same operating point.
- scenario current as the sum of explicitly named, simultaneously active branch currents.

The SI relationship `ohm = volt / ampere` and the derived watt relationships are defined in the [NIST SI guide](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes). Rated mechanical output, horsepower, fuse rating, or wire rating is not load current. Startup, stall, inductive flyback, PWM waveform, duty cycle, and transient current remain user/manufacturer inputs or `unknown`.

Each current result names its scenario and class: continuous, intermittent, startup, stall, or measured trace. A single scalar must not silently stand for all of them.

### Conductor resistance and voltage drop

For each current-carrying leg:

```text
R_leg = r(T) L
R_loop = sum(R_leg) + sum(R_connection)
delta_V = I R_loop
V_load = V_source - delta_V
P_loss = I^2 R_loop
drop_percent = 100 delta_V / V_reference
```

`r(T)` is preferably the cable manufacturer's maximum DC resistance per length at a stated temperature. When the cable is known copper and the source supplies an applicable linear coefficient, the MVP may use `R(T) = R_ref[1 + alpha(T - T_ref)]`; NIST's [Copper Wire Tables](https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook100.pdf) documents that temperature correction and tabulates coefficients. The tool must preserve whether resistance is nominal, maximum, or measured.

The user supplies the positive and return path lengths separately. Doubling one-way length is allowed only when the return is an equal-length conductor. Chassis, ground straps, terminals, splices, relays, fuse contacts, and connectors require sourced or measured resistance; omitted elements make the result `conductor-only`, never `total circuit`.

The user or vehicle specification supplies `V_source`, the operating condition (for example cranking or charging), and the allowed drop or minimum load voltage. The MVP can calculate and compare; it cannot choose those limits.

### Wire-size screening

The MVP may filter explicit cable candidates when each candidate has sourced conductor area, resistance, insulation family and temperature limit, continuous-current data or derating method, and applicable installation conditions. It also needs ambient temperature, bundle/routing condition, duty profile, terminal and connector limits, and the user's allowed voltage drop. [ISO 19642-3](https://www.iso.org/standard/66301.html) specifies dimensions and requirements for low-voltage copper automotive cable; [Littelfuse automotive Fuseology](https://www.littelfuse.com/assetdocs/automotive-passenger-car-catalog?assetguid=455de39d-b1d0-41f5-bcdc-c08d0451fa9c) treats insulation family and worst-case ambient temperature as inputs to wire-current capability. The MVP therefore does not turn cross-sectional area alone into an application-specific current rating.

Output is `candidate passes supplied screens`, with every unevaluated screen listed. No generic AWG-to-amp table, current-density constant, or hidden voltage-drop percentage is an authoritative wire-sizing rule.

### Fuse screening

[ISO 8820-2](https://www.iso.org/standard/55050.html) says automotive fuse-links are intended for cable protection and that multiple parameters must be considered in their choice and application. Therefore the MVP does not derive one fuse rating from load current alone.

For an explicit fuse series/part, the MVP may calculate continuous utilization and screen supplied load points against manufacturer data:

```text
derated_continuous_capacity = nominal_rating * manufacturer_factor_as_capacity_fraction
continuous_utilization = continuous_load / derated_continuous_capacity
```

Required evidence is fuse voltage and interrupt ratings, ambient-temperature rerating, holder/terminal limits, time-current or pulse-withstand data, the continuous and startup/stall load profile, prospective fault current, and the protected conductor's applicable limit. Littelfuse's automotive guide documents ambient rerating, wire/fuse matching, terminal voltage-drop effects, inrush behavior, and the need to validate the application with actual-circuit testing in [Fuseology](https://www.littelfuse.com/assetdocs/automotive-passenger-car-catalog?assetguid=455de39d-b1d0-41f5-bcdc-c08d0451fa9c).

The output remains a screen. Missing prospective fault current, time-current data, conductor protection evidence, or application testing keeps final fuse selection `unknown`. There is no universal MVP multiplier such as 125%; only the factor published for the exact fuse family and conditions is admissible.

## Fluid calculations

### Flow and mean velocity

For a circular passage with actual inside diameter `D`:

```text
A = pi D^2 / 4
volume_flow = A v
mass_flow = rho volume_flow
```

The continuity relationships are documented in the US Department of Energy's [Fluid Flow handbook](https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1012-92_VOL3.pdf) and by [NASA](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/conservation-of-mass/). The MVP may solve for any one variable when the others are explicit and unit-compatible.

Given a sourced maximum-velocity envelope, it may calculate the minimum mathematical ID, `D_min = sqrt(4 volume_flow / (pi v_max))`, then screen catalog IDs. The velocity envelope is a user/manufacturer input tied to application and fluid. It is not universal.

### Straight-hose and fitting pressure-drop estimate

The supported model is steady, single-phase, incompressible, Newtonian flow through a constant circular ID, with fluid properties evaluated at the stated temperature:

```text
Re = rho v D / mu
delta_p_major = f (L / D) (rho v^2 / 2)
delta_p_minor = sum(K) (rho v^2 / 2)
delta_p_total = delta_p_major + delta_p_minor
```

The Reynolds-number, Darcy loss, and minor-loss relationships are documented in the DOE [Fluid Flow handbook](https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1012-92_VOL3.pdf). For circular-pipe laminar flow below `Re = 2000`, `f = 64 / Re` is documented by [NASA](https://ntrs.nasa.gov/api/citations/19700030059/downloads/19700030059.pdf). The DOE handbook classifies `2000 <= Re <= 3500` as transitional, so the MVP returns `unknown` for a single pressure-drop prediction in that range. Above it, `f` requires an identified turbulent correlation or manufacturer curve plus relative roughness; the formula/source/version must be recorded.

Required inputs are actual hose ID and length, volume or mass flow, fluid density and dynamic viscosity at temperature, inner roughness or a sourced friction factor, and a `K` value for every fitting, entrance, exit, valve, and restriction. If `K` values are absent, the result is explicitly `straight-hose major loss only`. If elevation matters, static head is a separate term. Flexible-hose deformation and manufacturer test behavior create model uncertainty; when unquantified, the result is an estimate with `model uncertainty unknown`.

### Hose-size and pressure screening

Hose selection stays user/manufacturer-owned. Gates' [hydraulic catalog](https://www.gates.com/content/dam/documents-library/catalogs/gates-hydraulic-catalog-en.pdf) requires size, fluid and ambient temperature, application, material compatibility, pressure including spikes, ends/couplings, and delivery volume to be considered together. [SAE J517](https://saemobilus.sae.org/standards/j517_202007-hydraulic-hose) states that an assembly's maximum working pressure cannot exceed the lower SAE working-pressure value of its hose and connectors.

The MVP can screen a named hose assembly only when actual ID, fluid compatibility, minimum/maximum fluid and ambient temperatures, working and surge pressure, bend/routing limits, hose and coupling ratings, and applicable vehicle/industry standard are sourced. It must not infer working pressure from burst pressure, infer compatibility from a generic material name, or treat nominal/dash size as actual ID without product data.

Manufacturer pressure-drop curves for the exact hose and fluid conditions take precedence over the idealized Darcy estimate. A calculated diameter is a geometry candidate, not a safe hose selection.

## Thermal calculations and temperature representation

### Temperature values

Every temperature is typed as one of:

- measurement: sensor, location, medium, timestamp, operating state, calibration/provenance, and uncertainty;
- manufacturer threshold/range: exact part, function, tolerance, document revision;
- user target/limit: owner and rationale;
- calculated bulk estimate: formula, inputs, assumptions, and uncertainty;
- unknown.

The model also distinguishes absolute temperature from temperature interval. NIST publishes `K = degrees C + 273.15`, `degrees C = (degrees F - 32) / 1.8`, and equal-size kelvin/Celsius intervals in its [temperature guidance](https://www.nist.gov/pml/owm/si-units-temperature). The MVP retains the original representation and converts for display or calculation; it does not relabel a thermostat rating as measured coolant, metal, oil, under-hood air, or radiator-outlet temperature.

### Thermostat state

A wax thermostat begins moving a valve when its temperature-sensitive element expands; electronically map-controlled thermostats can also be heated under ECU control, as described by [Gates](https://www.gatestechzone.com/en/news/2021-04-map-controlled-thermostats) and [MAHLE](https://www.mahle-aftermarket.com/media/homepage/facelift/media-center/klima/mah-kompaktwissen-ec-fahrzeugkuehlung-en-screen.pdf). Temperature alone therefore cannot prove actual valve position.

For a mechanical thermostat with sourced begin-open and full-open ranges, and a measured temperature at the thermostat with uncertainty, the MVP may report only an expected thermal region:

- entirely below the begin-open range: `expected below opening range`;
- overlapping the opening span: `transition/indeterminate`;
- entirely above the full-open range: `expected at or above full-open range`.

Actual position remains `unknown` without position/flow evidence. If only an opening temperature is published, the MVP cannot invent a full-open threshold. For map-controlled thermostats, ECU command/heater state and the applicable control strategy are additional inputs; without them, expected position is `unknown`. Stuck-open and stuck-closed failures are real distinct modes described by [Gates](https://www.gatestechzone.com/en/problem-diagnosis/cooling-system/thermostat-failure-signs), so a threshold comparison is never a health diagnosis.

### Sensible heat carried by a fluid

The MVP may calculate:

```text
thermal_power = mass_flow * cp * (T_out - T_in)
```

only for the same steady stream, no phase change, representative bulk inlet/outlet temperatures, and a sourced average `cp` valid for the fluid composition and temperature span. The DOE [Thermodynamics handbook](https://www.energy.gov/sites/default/files/2026-04/DOE-HDBK-1012-92_VOL1.pdf) gives this relationship and explicitly limits it where phase change occurs. The result is heat carried by that stream under the stated assumptions, not radiator capacity, engine heat rejection, or predicted operating temperature.

## Ownership of inputs

The user, vehicle manufacturer, or component manufacturer must supply:

- vehicle voltage range and operating scenarios; continuous/startup/stall load traces; allowed voltage drop; cable, terminal, connector, fuse, and holder data;
- exact fluid/product and concentration; density, viscosity, and specific heat versus temperature; flow or pressure boundary; actual hose/fitting geometry and loss data; pressure spikes and compatibility limits;
- sensor readings and uncertainty; measurement location/time/state; exact thermostat part, begin/full-open specifications and tolerance; ECU strategy for map-controlled units;
- the applicable vehicle, racing, road-use, emissions, fire, and safety requirements.

Conflicting values are preserved with provenance and reported as a conflict. They are not averaged automatically.

## Unknown and deferred

The MVP keeps these unknown unless direct evidence is supplied:

- actual chassis-return, splice, terminal, and connector resistance;
- transient/stall current, fault current, fuse clearing behavior, and conductor temperature;
- hose roughness/deformation, fitting losses, pressure spikes, fluid properties at temperature, and actual flow;
- thermostat valve position, health, hysteresis, bypass flow, ECU heater command, and any temperature at an unmeasured location;
- uncertainty where source tolerance, distribution, correlation, or model error is absent.

Deferred beyond MVP:

- authoritative wire/fuse/hose selection, safety certification, fault protection, and physical validation;
- cranking, alternator/battery, short-circuit, PWM, inductive, high-voltage, or AC transient simulation;
- compressible, pulsating, cavitating, non-Newtonian, two-phase, phase-change, or water-hammer flow;
- pump/system curves, radiator or heat-exchanger sizing, boiling/freezing margin, warm-up prediction, thermostat dynamics, and whole-vehicle thermal balance;
- brake, fuel-injection, refrigerant, and other regulated or life-safety system design;
- statistical uncertainty propagation without a complete GUM-compatible measurement model.

## Source limitations

SAE and ISO full standards are paywalled; their public primary-source pages establish scope and top-level requirements but do not expose every selection table or test detail. Manufacturer catalogs are first-party application evidence, not universal standards, and must be pinned to product and revision. DOE and NASA formulas are primary government technical sources for idealized pipe flow and energy balance; applying them to flexible automotive hose leaves model-form error that the cited sources do not quantify.
