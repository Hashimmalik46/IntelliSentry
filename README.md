<div align="center">

  <img src="./client/public/favicon.svg" alt="IntelliSentry Logo" width="88" height="88" />

  # IntelliSentry
  ### Intelligent Multi-Factor Hostel Access & Safety Monitoring Platform

  An enterprise-grade campus security solution integrating multi-factor biometric authentication, geodesic geofencing, real-time curfew automation, and parental two-factor SMS verification.

  <p align="center">
    <a href="https://intellisentry.vercel.app" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/status-live-34D399?style=flat&labelColor=374151" alt="Status" />
    </a>
    <img src="https://img.shields.io/badge/version-v2.0.0-F97316?style=flat&labelColor=374151" alt="Version" />
    <a href="https://github.com/Hashimmalik46/IntelliSentry/stargazers" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/github/stars/Hashimmalik46/IntelliSentry?style=flat&label=stars&color=0284C7&labelColor=374151" alt="Stars" />
    </a>
    <a href="#license">
      <img src="https://img.shields.io/badge/license-MIT-EC4899?style=flat&labelColor=374151" alt="License" />
    </a>
    <img src="https://img.shields.io/badge/biometrics-ArcFace%20AI-8B5CF6?style=flat&labelColor=374151" alt="Biometrics" />
    <img src="https://img.shields.io/badge/parent%202FA-Twilio%20OTP-F43F5E?style=flat&labelColor=374151" alt="Twilio 2FA" />
  </p>

  <p align="center">
    <a href="#-key-features"><b>✨ Features</b></a> &nbsp;•&nbsp;
    <a href="#-core-architecture"><b>🧬 Architecture</b></a> &nbsp;•&nbsp;
    <a href="#-security-framework"><b>🛡️ Security</b></a> &nbsp;•&nbsp;
    <a href="#-tech-stack"><b>💻 Tech Stack</b></a> &nbsp;•&nbsp;
    <a href="#-user-portals"><b>👥 Portals</b></a> &nbsp;•&nbsp;
    <a href="#-getting-started"><b>🚀 Quick Start</b></a>
  </p>

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Core Architecture](#-core-architecture)
- [Multi-Tier Security Framework](#-multi-tier-security-framework)
  - [1. Deep Metric Biometric AI & Anti-Spoofing](#1-deep-metric-biometric-ai--anti-spoofing)
  - [2. Dual Geofencing Spatial Engine](#2-dual-geofencing-spatial-engine)
  - [3. Parent 2FA Verification & Leave Pass Engine](#3-parent-2fa-verification--leave-pass-engine)
  - [4. Dynamic Curfew & Emergency Protocols](#4-dynamic-curfew--emergency-protocols)
- [User Roles & Portals](#-user-roles--portals)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
- [License & Attribution](#-license--attribution)

---

## 📖 Overview

**IntelliSentry** is a next-generation residential safety and access monitoring platform designed to eliminate the vulnerabilities of traditional hostel register logs, RFID card proxies, and unverified out-of-campus movements.

By synchronizing **spatial GPS boundaries**, **deep biometric facial metric learning**, **presentation attack anti-spoofing**, **automated parent 2FA SMS approvals**, and **dynamic curfew guardrails**, IntelliSentry establishes a zero-trust access ecosystem tailored for modern university residential campuses.

```
       ┌──────────────────┐
       │ Student at Gate  │
       └────────┬─────────┘
                │
         [Step 1: Geofence]
     GPS Location Radius Check
                │
                ▼
        [Step 2: Biometrics]
     Anti-Spoof Liveness + Face AI
                │
                ▼
        [Step 3: Verification]
    Curfew & Leave Pass 2FA Engine
                │
                ▼
  ┌─────────────────────────────┐
  │ ✅ AUTHORIZED GATE MOVEMENT  │
  └─────────────────────────────┘
```

---

## ✨ Key Features

- **🌐 Dual Spatial Geofencing**: Validates physical presence via spherical great-circle radial calculations and polygon ray-casting.
- **🧬 Deep Metric Facial Recognition**: High-precision metric embedding pipeline utilizing custom deep residual networks with additive angular margin loss.
- **🛡️ 3-Tier Presentation Attack Defense**: Multi-spectral liveness detection detecting printouts, grayscale photocopies, and digital display glares.
- **📱 2FA Parent SMS Verification**: Real-time pass approval workflow dispatching single-use cryptographic tokens and 6-digit OTP verification via Twilio.
- **⏰ Dynamic Curfew Automation**: Centralized curfew engine with real-time countdown alerts, pre-curfew warnings, and automated movement lockouts.
- **🚨 Warden Emergency Clearances**: Dedicated administrative override mechanisms for authorized emergency inbound/outbound movements.
- **👥 Role-Based Access Control**: Multi-tenant architecture isolating Student actions from Warden administration and Master Headcount audits.
- **📊 Real-Time Audit Logs**: Centralized activity monitoring with custom date ranges, movement filters, and one-click security report exports.

---

## 🏗️ Core Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend Client (React 19 + Tailwind CSS 4)"]
        A[Student & Warden Dashboards] --> B[Camera Stream & Geolocation]
        B --> C[Unified Verification Flow]
    end

    subgraph Backend ["Backend Engine (Python Flask + PyTorch)"]
        C --> D[Geofence Validation Engine]
        C --> E[3-Tier Anti-Spoofing & Biometrics]
        C --> F[Parent 2FA & Pass Service]
    end

    subgraph Cloud ["Cloud & Data Infrastructure"]
        E <--> G[(Supabase Cloud Database)]
        F <--> H[Twilio REST Gateway]
        D & E --> I[(Secure Movement Audit Logs)]
    end
```

---

## 🛡️ Multi-Tier Security Framework

```
                  ┌─────────────────────────────────────┐
                  │    IntelliSentry Multi-Factor AI    │
                  └──────────────────┬──────────────────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     ▼                               ▼                               ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     Spatial Geofence    │ │      Biometric AI       │ │    Parent 2FA & Curfew  │
├─────────────────────────┤ ├─────────────────────────┤ ├─────────────────────────┤
│ • Geodesic Radius Check │ │ • Anti-Spoof Liveness   │ │ • Single-Use SMS Tokens │
│ • Polygon Ray-Casting   │ │ • Deep Metric Embeddings│ │ • 6-Digit OTP Validation│
│ • Anti-Location Spoof   │ │ • Fault-Tolerant Engine │ │ • Dynamic Gate Lockouts │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

### 1. Deep Metric Biometric AI & Anti-Spoofing
- **Metric Embedding Model**: Custom deep residual architecture generating compact normalized embedding vectors for rapid cosine similarity matching.
- **Liveness & Presentation Attack Detection**:
  - *Edge Variance Filter*: Screens for static low-resolution or blurred printout attacks.
  - *Color Saturation Analysis*: Detects monochromatic and grayscale photocopies.
  - *Frequency Spectrum Moiré Analysis*: Detects digital screen glare, pixel grids, and monitor displays.
- **Multi-Engine Redundancy**: Fault-tolerant cascade ensuring high availability across edge environments and CPU fallbacks.

### 2. Dual Geofencing Spatial Engine
- **Radial Geodesic Distance**: Enforces strict physical distance boundaries relative to campus coordinates using the Haversine spherical distance model.
- **Planar Boundary Validation**: Evaluates non-circular campus perimeter geometries via metric coordinate projection and topological ray-casting containment.

### 3. Parent 2FA Verification & Leave Pass Engine
- **Cryptographic Request Links**: Outbound home leave passes dispatch single-use, time-limited approval URLs directly to verified parental contacts.
- **6-Digit OTP Layer**: Parents verify authorization via an interactive SMS OTP flow with automated expiration and brute-force attempt limits.
- **Warden Final Review**: Dual-stage approval ensuring parental confirmation prior to administrative gate pass issuance.

### 4. Dynamic Curfew & Emergency Protocols
- **Real-Time Curfew Synchronization**: Dynamic policy updates broadcast across student portals and gate monitors.
- **Pre-Curfew Warning Alerts**: Visual countdown notifications for residents outside premises approaching curfew deadlines.
- **Warden Emergency Overrides**: Restricted supervisory clearance tools for urgent medical or emergency departures during curfew hours.

---

## 👥 User Roles & Portals

| Portal | Target Audience | Primary Capabilities |
| :--- | :--- | :--- |
| **Student Portal** | Hostel Residents | Biometric gate scans, leave pass requests, curfew countdowns, movement history. |
| **Admin Dashboard** | Wardens & Security | Master resident headcounts, dynamic curfew controls, overdue alerts, emergency overrides. |
| **Onboarding Portal** | Housing Administrators | Student account activation, room & hostel allocations, verified contact linkage. |
| **Pass Management** | Wardens | Review 2FA parent-verified passes, grant final authorizations, track active passes. |
| **Activity Audit** | Campus Security | Comprehensive gate movement audit logs, date filters, security CSV exports. |
| **Parent Portal** | Parents / Guardians | Mobile-friendly 2FA OTP review portal for outbound student leave authorization. |

---

## 💻 Tech Stack

<div align="center">

### Frontend
<p align="center">
  <img src="https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB&labelColor=374151" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white&labelColor=374151" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-38B2AC?style=flat&logo=tailwind-css&logoColor=white&labelColor=374151" alt="TailwindCSS 4" />
  <img src="https://img.shields.io/badge/Lucide_Icons-F43F5E?style=flat&logo=lucide&logoColor=white&labelColor=374151" alt="Lucide Icons" />
  <img src="https://img.shields.io/badge/React_Router_7-CA4245?style=flat&logo=react-router&logoColor=white&labelColor=374151" alt="React Router" />
</p>

### Backend & Machine Learning
<p align="center">
  <img src="https://img.shields.io/badge/Python_3.12-3776AB?style=flat&logo=python&logoColor=white&labelColor=374151" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white&labelColor=374151" alt="Flask" />
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat&logo=pytorch&logoColor=white&labelColor=374151" alt="PyTorch" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white&labelColor=374151" alt="OpenCV" />
  <img src="https://img.shields.io/badge/Gunicorn-499848?style=flat&logo=gunicorn&logoColor=white&labelColor=374151" alt="Gunicorn" />
  <img src="https://img.shields.io/badge/Shapely_&_PyProj-0284C7?style=flat&logo=geopandas&logoColor=white&labelColor=374151" alt="GIS Geofencing" />
</p>

### Cloud & Database
<p align="center">
  <img src="https://img.shields.io/badge/Supabase_PostgreSQL-3ECF8E?style=flat&logo=supabase&logoColor=white&labelColor=374151" alt="Supabase" />
  <img src="https://img.shields.io/badge/Twilio_REST_API-F22F46?style=flat&logo=twilio&logoColor=white&labelColor=374151" alt="Twilio" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white&labelColor=374151" alt="Vercel" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=black&labelColor=374151" alt="Render" />
</p>

</div>

---

## 📁 Repository Structure

```
IntelliSentry/
├── client/                     # Frontend React 19 Application (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Verification modals, camera capture, responsive layout
│   │   ├── pages/              # Dashboards, onboarding, passes, activity logs
│   │   └── utils/              # Dynamic curfew & geolocation utilities
│   ├── public/                 # Static branding assets & web worker models
│   └── package.json
│
├── server/                     # Backend Python API & ML Inference Engine
│   ├── weights/                # Pre-trained deep biometric model checkpoints
│   ├── app.py                  # API service routes & security controllers
│   ├── face_service.py         # Biometric metric embedding & anti-spoofing pipeline
│   ├── sms_service.py          # Twilio SMS 2FA & OTP verification service
│   ├── haversine_check.py      # Spatial geodesic distance calculator
│   ├── pip_check.py            # Polygonal boundary verification engine
│   └── requirements.txt
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.x` or higher
- **Python**: `v3.10` – `v3.12`
- **Supabase**: PostgreSQL database instance
- **Twilio**: SMS API credentials

---

### Step 1: Clone Repository
```bash
git clone https://github.com/Hashimmalik46/IntelliSentry.git
cd IntelliSentry
```

---

### Step 2: Backend Setup
```bash
cd server
python -m venv .venv

# Activate Virtual Environment (Windows / Linux)
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # Linux / macOS

pip install -r requirements.txt
python app.py
```
*Backend runs on `http://127.0.0.1:5000`.*

---

### Step 3: Frontend Setup
```bash
cd ../client
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 📄 License & Attribution

This project is licensed under the **MIT License** — see the `LICENSE` file for details.

Developed for the **Department of Computer Science & Engineering**, **Islamic University of Science & Technology (IUST)**.

---

<div align="center">
  <sub>Built with ❤️ for Campus Safety and Modern Residential Security.</sub>
</div>
