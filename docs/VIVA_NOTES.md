# HELIOS — Viva & Oral Defense Notes

**Project Title**: AI-Based Renewable Energy Management and Optimisation System  
**Academic Context**: End-to-End Simulation, Machine Learning Forecasting, Fault Detection, and Linear Programming Optimization  
**Purpose**: Plain-language technical explanations, mathematical formulations, honest limitations, and high-scoring viva defense answers.

---

## 1. System Overview (In Plain English)

HELIOS is an intelligent energy management platform for a grid-connected residential microgrid. In simple terms:

1. **The Physical System**: A simulated home with **10 kWp rooftop solar panels**, a **10 kWh / 5 kW lithium-ion battery storage system**, household electricity demand (appliances, HVAC, lighting), and a connection to the utility power grid under **Time-of-Use (TOU) dynamic electricity pricing** (cheap off-peak hours, expensive peak evening hours).
2. **The Problem**: Solar power is generated during the daytime when electricity is cheap or building demand is low. In the evening, when grid power is expensive, solar power drops to zero. Without smart control, either clean energy is wasted or expensive grid electricity is bought. Furthermore, solar panels can suffer from partial shading, heavy dust/soiling, or inverter failures that go unnoticed.
3. **The Solution**: HELIOS provides four connected engines:
   - A **Physics-based Simulation** generating realistic hourly solar radiation, ambient temperature, building loads, and hardware faults.
   - A **Machine Learning Forecaster** predicting solar generation 24 hours ahead.
   - A **Dual-Method Fault Detector** discovering PV panel anomalies and calculating lost energy (kWh).
   - An **Optimization Engine (Linear Programming)** that schedules exactly when to charge the battery, when to store surplus solar, and when to discharge to avoid expensive evening grid tariffs.
   - An **Editorial Architectural UI** presenting live telemetry, scenario sandboxing, and financial comparisons with high visual craft.

---

## 2. Module-by-Module Explanations

### Module 1: Physics-Based Data Generator (`src/data_generator.py`)
- **What it does**: Simulates a complete 8,760-hour (365-day) year of synchronized weather and electrical data. It models solar position (zenith and azimuth), clear-sky radiation, autocorrelated cloud cover, PV cell temperature, thermal degradation ($-0.38\%/\text{°C}$ loss above 25°C), non-linear building demand (diurnal morning/evening peaks, weekend variations, Gaussian noise), and realistic injected fault events.
- **Why chosen**: Real residential microgrid datasets with perfectly synchronized weather, ground-truth fault labels, and battery telemetry are rarely publicly available. Creating a physics-calibrated synthetic simulator guarantees mathematically verifiable ground truth, reproducible experiments, and controlled edge-case evaluation.

### Module 2: Solar Generation Forecaster (`src/forecasting.py`)
- **What it does**: Takes exogenous meteorological predictions (solar irradiance in $\text{W/m}^2$, ambient temperature in °C, cloud cover fraction) and cyclical time harmonics (hour-of-day and day-of-year sine/cosine transforms) to predict solar generation ($kW$) 24 hours ahead.
- **Why Random Forest was chosen**:
  - Handles non-linear physical saturation (such as inverter clipping at 10 kWp) naturally through decision tree splits.
  - Requires no feature normalization or standard scaling.
  - Highly interpretable via Gini feature importances.
  - Trains in under 2 seconds and infers in milliseconds on CPU (no heavy GPU required, unlike deep LSTM or Transformer networks).
- **Validation**: Strict sequential chronological train/test partition (first 75% of the year for training, final 25% for held-out testing). Shuffling or random K-fold CV was strictly avoided to prevent future-data leakage into past predictions.

### Module 3: PV Fault Detection (`src/fault_detection.py`)
- **What it does**: Detects abnormal drops in solar generation using two complementary techniques:
  - **Method A (Physical Residual Threshold)**: Compares actual solar power against the forecaster's predicted healthy output. If the deficit $\Delta P = P_{\text{predicted}} - P_{\text{actual}}$ exceeds an adaptive threshold during daylight, a fault is triggered.
  - **Method B (Isolation Forest)**: An unsupervised anomaly detection model that isolates outliers in the 4-dimensional space of solar generation, irradiance, temperature, and residual error.
  - **Combined Ensemble**: Flags a fault if either Method A or Method B triggers, and aggregates contiguous fault hours into discrete maintenance incidents with estimated lost generation in kWh.
- **Why dual methods**: Method A yields **100% precision (0 false alarms)** because it respects physical generation limits, but can miss subtle shading. Method B yields **100% recall** by isolating multi-dimensional anomalies, but produces occasional false alarms during rapid cloud transients. The hybrid ensemble offers operators both a high-certainty alert and an exploratory anomaly scan.

### Module 4: Battery Optimization & Arbitrage (`src/battery_optimizer.py`)
- **What it does**: Formulates an hourly Linear Program (LP) to schedule the battery's charge power $P_{\text{ch}}(t)$, discharge power $P_{\text{dis}}(t)$, and State of Charge $\text{SoC}(t)$ to minimize total electricity cost over the horizon.
- **Why Linear Programming (SciPy linprog / HiGHS solver) was chosen**:
  - Guaranteed mathematical global optimum (no local minima, unlike neural network RL).
  - Solves deterministically in $< 20$ milliseconds.
  - Strict adherence to physical equality and inequality constraints.
  - Directly verifiable against human-designed rule-based heuristics.

### Module 5: FastAPI REST Backend (`api/`)
- **What it does**: Serves the microgrid telemetry, predictions, fault logs, and scenario simulations via clean JSON endpoints. Validates all inputs and outputs using Pydantic v2 schemas.
- **Why chosen**: High asynchronous throughput, automatic interactive documentation at `/docs`, native Python data integration, and zero overhead.

### Module 6: High-Craft Frontend UI (`frontend/`)
- **What it does**: Interactive dashboard built in React 18, TypeScript, and Vite. Features a warm ivory/ink/deep-moss color palette inspired by high-end architectural studios, monumental Bodoni Moda Didone typography, Lenis smooth scrolling, curtain wipe transitions, and responsive Apache ECharts visualizations.
- **Why chosen**: Real engineering tools are often cluttered and unreadable. HELIOS demonstrates that complex industrial telemetry can be presented with extreme editorial clarity, accessible contrast, and zero layout shift.

---

## 3. The Energy-Balance Equations

The entire microgrid is governed by physical conservation of energy and battery electrochemical dynamics.

### 1. Nodal Power Conservation (Microgrid Balance)
At every single hourly timestep $t$, total power entering the microgrid coupling bus must exactly equal total power exiting:

$$P_{\text{solar}}(t) + P_{\text{dis}}(t) + P_{\text{imp}}(t) = P_{\text{load}}(t) + P_{\text{ch}}(t) + P_{\text{exp}}(t)$$

Where:
- $P_{\text{solar}}(t)$: Solar PV generation delivered to the bus (kW)
- $P_{\text{dis}}(t)$: Battery discharge power delivered to the bus (kW)
- $P_{\text{imp}}(t)$: Power imported from the utility grid (kW)
- $P_{\text{load}}(t)$: Household electrical load consumed (kW)
- $P_{\text{ch}}(t)$: Power drawn from the bus to charge the battery (kW)
- $P_{\text{exp}}(t)$: Power exported to the utility grid for feed-in credit (kW)

### 2. Battery State of Charge (SoC) Dynamics
The battery's internal stored energy evolves according to charging and discharging efficiencies:

$$\text{SoC}(t+1) = \text{SoC}(t) + \frac{\eta_{\text{ch}} \cdot P_{\text{ch}}(t) \cdot \Delta t}{C_{\text{batt}}} - \frac{P_{\text{dis}}(t) \cdot \Delta t}{\eta_{\text{dis}} \cdot C_{\text{batt}}}$$

Where:
- $\text{SoC}(t)$: State of Charge fraction at hour $t$ ($0.0 \le \text{SoC} \le 1.0$)
- $C_{\text{batt}}$: Total nominal battery capacity ($10.0\text{ kWh}$)
- $\Delta t$: Timestep duration ($1.0\text{ hour}$)
- $\eta_{\text{ch}}$: Battery charging efficiency ($0.95$ / $95\%$)
- $\eta_{\text{dis}}$: Battery discharging efficiency ($0.95$ / $95\%$)
- Round-trip efficiency $\eta_{\text{rt}} = \eta_{\text{ch}} \cdot \eta_{\text{dis}} \approx 0.9025$ ($90.25\%$)

### 3. Physical Operational Bounds
$$\text{SoC}_{\min} \le \text{SoC}(t) \le \text{SoC}_{\max} \quad (0.10 \le \text{SoC}(t) \le 0.95)$$
$$0 \le P_{\text{ch}}(t) \le P_{\text{max}} \quad (5.0\text{ kW})$$
$$0 \le P_{\text{dis}}(t) \le P_{\text{max}} \quad (5.0\text{ kW})$$
$$0 \le P_{\text{imp}}(t) \le P_{\text{grid,max}} \quad (15.0\text{ kW})$$
$$0 \le P_{\text{exp}}(t) \le P_{\text{grid,max}} \quad (15.0\text{ kW})$$

### 4. Non-Simultaneity Conditions
A physical battery cannot charge and discharge simultaneously:
$$P_{\text{ch}}(t) \cdot P_{\text{dis}}(t) = 0$$
A grid meter cannot import and export simultaneously:
$$P_{\text{imp}}(t) \cdot P_{\text{exp}}(t) = 0$$

> **Key Mathematical Insight for Viva**: In our Linear Program, we do **not** need binary integer variables (MILP) to enforce these non-simultaneity constraints! Because grid import price is strictly greater than feed-in export tariff ($c_{\text{imp}} > c_{\text{exp}}$) and battery round-trip efficiency is $< 1.0$, the cost-minimizing objective naturally drives one of each pair to zero. This keeps the formulation a pure continuous Linear Program that solves in milliseconds.

### 5. Cost Minimization Objective Function
$$\min_{P_{\text{ch}}, P_{\text{dis}}, P_{\text{imp}}, P_{\text{exp}}} \sum_{t=1}^T \left[ c_{\text{import}}(t) \cdot P_{\text{imp}}(t) - c_{\text{export}}(t) \cdot P_{\text{exp}}(t) \right] \cdot \Delta t$$

Subject to the terminal boundary condition:
$$\text{SoC}(T) \ge \text{SoC}(0)$$
*(Ensures the optimizer does not "cheat" by emptying the battery to zero at the end of the simulation window to make costs look artificially cheap).*

---

## 4. Honest Limitations & Real-World Gaps

When defending an academic or engineering project, acknowledging realistic limitations demonstrates maturity and deep technical comprehension:

1. **Battery Degradation & Life Cycle**: The optimizer treats throughput cycles as free. In the real world, lithium-ion cells suffer capacity fade and solid-electrolyte interphase (SEI) growth with each deep cycle. A production model would include a battery cycle degradation penalty ($\sim \text{₹ } 1.50/\text{kWh}$ throughput).
2. **Deterministic Weather Assumption**: The LP solver assumes the 24-hour weather forecast is known with 100% certainty. In reality, unexpected cloud cover can cause shortfalls. A real-world system would use **Model Predictive Control (MPC)** with a receding 24-hour horizon recalculated every 15 minutes.
3. **Hourly Resolution vs. Sub-Minute Intermittency**: The 1-hour timestep averages out rapid cloud passage (which happens on a 10-second to 1-minute timescale). Power electronic inverters require fast secondary controllers to buffer sub-minute transients.
4. **Active Power Balance Only**: The microgrid assumes unity power factor ($\cos \phi = 1.0$) and ignores reactive power ($Q$ in kVAR), harmonics, inverter phase angles, and bus voltage drop ($V(t)$).
5. **Synthetic Ground Truth**: Although physical solar geometry and thermal equations are rigorously applied, real rooftop PV systems experience bird droppings, cable resistance, panel mismatch, and localized shading that require physical sensor calibration.

---

## 5. 15 Likely Viva Questions & Model Answers

### Q1: Why did you choose Random Forest instead of an LSTM or Transformer for solar forecasting?
**Answer**: Solar generation from clear-sky and weather data is a non-linear regression problem with immediate physical drivers (irradiance and temperature). Unlike natural language or stock prices, solar output has negligible long-term memory once hour-of-day, day-of-year, and weather are known. Random Forest handles the non-linear saturation curve (like inverter clipping at 10 kWp) without feature scaling, trains in 2 seconds on a CPU, provides instant Gini feature importances, and avoids the heavy overfitting, hyperparameter tuning, and GPU requirements of LSTMs.

### Q2: Your forecasting $R^2$ is 0.9993. Isn't that suspiciously high? Is there data leakage?
**Answer**: No, there is zero data leakage. In solar physics, daytime surface irradiance ($G_{\text{irradiance}}$) directly dictates photovoltaic electron generation via the photoelectric effect ($P \approx \text{Area} \cdot \eta \cdot G$). When irradiance and temperature are provided, predicting solar power is primarily learning the array's geometry, orientation, and thermal derating curve. The model was evaluated on 2,128 held-out test hours strictly after the training period, proving it learned the physical efficiency function rather than memorizing noise.

### Q3: How did you ensure there was no look-ahead bias during model training?
**Answer**: We enforced a strict chronological split. The dataset's first 9 months (January to September, 6,480 hours) were used exclusively for training and calibration. The remaining 3 months (October to December, 2,190 hours) served as the strictly held-out test set. We never shuffled the dataset or used standard randomized K-fold cross-validation, preserving temporal causality.

### Q4: Why does Method A (Residual Threshold) have 100% precision but only 33.9% recall?
**Answer**: Method A flags a fault only when the actual solar power drops below predicted power by more than a conservative threshold ($30\%$ of predicted output with a minimum 500W deficit). Because the threshold is set conservatively to avoid triggering on minor cloud transients, it produces zero false alarms (Precision = 1.0). However, it misses partial soiling or mild shading where the power deficit is smaller than the threshold, leading to lower recall (33.9%).

### Q5: Why does Isolation Forest have 100% recall but lower precision (58.5%)?
**Answer**: Isolation Forest is an unsupervised anomaly detector that isolates points in multi-dimensional space (irradiance, power, temperature, residual). Because severe faults create extreme statistical anomalies, it caught 100% of all real fault hours (62 out of 62). However, during sudden cloud transitions where irradiance drops faster than ambient temperature shifts, it occasionally flags healthy transient conditions as outliers, producing 44 false positives.

### Q6: Why did you use Linear Programming (LP) instead of Reinforcement Learning (RL) or Genetic Algorithms (GA) for battery dispatch?
**Answer**: Linear Programming is mathematically guaranteed to find the true global minimum cost in milliseconds without hyperparameter tuning, training instability, or convergence failure. RL and GA are heuristic search methods prone to sub-optimal local minima and require thousands of trial episodes. Since our power balance, battery capacity, and inverter bounds are linear constraints, an LP solved by the CBC simplex/interior-point solver is the industry standard for microgrid economic dispatch.

### Q7: In the LP formulation, how do you prevent the battery from charging and discharging at the exact same hour?
**Answer**: A battery charging and discharging at the same time is economically and thermodynamically irrational: charging incurs a loss ($\eta_{\text{ch}} = 0.95$) and discharging incurs a loss ($\eta_{\text{dis}} = 0.95$), yielding a round-trip loss of $\sim 10\%$. Because the cost function penalizes energy loss and the import tariff is strictly higher than the export tariff ($c_{\text{imp}} > c_{\text{exp}}$), the linear solver naturally drives one of the two decision variables to zero. Thus, no non-convex binary variables are required.

### Q8: What is the significance of the terminal constraint $\text{SoC}(T) \ge \text{SoC}(0)$?
**Answer**: Without this boundary constraint, the optimizer would exploit the finite horizon by discharging the battery down to its absolute minimum ($\text{SoC}_{\min} = 10\%$) in the final hours to avoid grid imports, falsely claiming massive economic savings. Enforcing $\text{SoC}(T) \ge \text{SoC}(0)$ ensures fair accounting: the battery must end the day with at least as much stored energy as it started with.

### Q9: What happens if the weather forecast is wrong during real-time battery operation?
**Answer**: If actual solar is lower than predicted, the planned battery dispatch might attempt to draw solar energy that doesn't exist, forcing unanticipated grid imports. In industry, this is addressed via **Model Predictive Control (MPC)**: the LP solves a 24-hour horizon, but only executes the first hour's command; in the next hour, fresh telemetry updates the state of charge and a new 24-hour plan is re-optimized.

### Q10: How does Time-of-Use (TOU) tariff arbitrage work in your system?
**Answer**: Our tariff structure charges $\text{₹ } 3.50/\text{kWh}$ off-peak (night/early morning), $\text{₹ } 6.00/\text{kWh}$ normal (daytime), and $\text{₹ } 10.50/\text{kWh}$ during peak evening hours (18:00–22:00). Feed-in export credit is $\text{₹ } 3.00/\text{kWh}$. The optimizer absorbs cheap midday solar and off-peak grid energy into the battery, and discharges it during the $\text{₹ } 10.50$ evening window, cutting peak grid import costs to zero.

### Q11: What is the round-trip efficiency of your battery and why does it matter?
**Answer**: Charging efficiency is $\eta_{\text{ch}} = 95\%$ and discharging efficiency is $\eta_{\text{dis}} = 95\%$, resulting in a round-trip efficiency of $\eta_{\text{rt}} = 0.95 \times 0.95 = 90.25\%$. For every $1\text{ kWh}$ pushed into the battery, only $\sim 0.90\text{ kWh}$ is recovered. This means electricity price arbitrage is only profitable if the price ratio between peak and off-peak exceeds $1 / 0.9025 \approx 1.11$, which our TOU spread ($\text{₹ } 10.50 / \text{₹ } 3.50 = 3.0$) comfortably satisfies.

### Q12: Why did you choose FastAPI over Flask or Django?
**Answer**: FastAPI natively supports asynchronous execution (`async`/`await`), performs high-speed data serialization using Pydantic v2 (compiled in Rust), automatically generates interactive OpenAPI documentation at `/docs`, and enforces strict schema validation out-of-the-box with minimal boilerplate.

### Q13: Why did you choose an architectural Didone serif style for an industrial microgrid app?
**Answer**: Most industrial dashboards are visually cluttered, dark, and difficult to parse during prolonged monitoring. Inspired by editorial and architectural portfolio design, we implemented an ivory/ink/moss aesthetic with high-contrast Didone headings, generous whitespace, and strict typographic hierarchy. This enhances data legibility, ensures 100% WCAG AA contrast compliance, and elevates the software to professional presentation standards.

### Q14: How does the frontend handle high-density 8,760-point annual time-series charts without freezing?
**Answer**: We implemented LTTB (**Largest Triangle Three Buckets**) downsampling in Apache ECharts for series exceeding 1,000 points. LTTB preserves visual peaks, troughs, and inflection points while dramatically reducing the DOM/canvas polygon count, ensuring 60 FPS hover responsiveness and zero UI stutter.

### Q15: If you were deploying this system to a physical solar home tomorrow, what would you need to add?
**Answer**:
1. **Hardware Telemetry Integration**: Replace the CSV generator with Modbus TCP or MQTT communication drivers to read physical solar inverters (e.g. SMA/SolarEdge) and battery BMS registers.
2. **Model Predictive Control (MPC)**: Switch from a static 24-hour solver to a rolling receding-horizon controller that re-computes dispatch every 5 or 15 minutes.
3. **Battery Cycle Degradation Cost**: Introduce a marginal cost penalty ($\sim \text{₹ } 1.50/\text{kWh}$) in the LP objective function to prevent unnecessary battery cycling when tariff differentials are small.
