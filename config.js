// ═══════════════════════════════════════════════════════════════
// config.js — Configuração Central do Pro'B
// ---------------------------------------------------------------
// ATENÇÃO: Este arquivo contém dados sensíveis do sistema.
// Não compartilhe nem versione publicamente sem ofuscar os valores.
// Para alterar qualquer configuração, edite APENAS este arquivo.
// ═══════════════════════════════════════════════════════════════

const PROB_CONFIG = {

    // ── Firebase ──────────────────────────────────────────────
    firebase: {
        apiKey:            "AIzaSyC3kWQlfB4x2zms_Qb8ulgB5J-u-qmKMLg",
        authDomain:        "pro-b-800da.firebaseapp.com",
        projectId:         "pro-b-800da",
        storageBucket:     "pro-b-800da.firebasestorage.app",
        messagingSenderId: "796500919926",
        appId:             "1:796500919926:web:c277767d4f9a79dced8157"
    },

    // ── Administrador ─────────────────────────────────────────
    admin: {
        uid:   "GfWnHPvjPjXUgmGjUbuRtdvLtpX2",  // UID Firebase do admin
        email: "ale.sh4rk@gmail.com"
        // WPP e PIX ficam no Firestore (config/admin) — não expostos no código
    },

    // ── Sistema ───────────────────────────────────────────────
    sistema: {
        nome:          "Pro'B",
        versao:        "1.0",
        precoMensal:   45,    // R$ — valor padrão (pode ser personalizado por cliente no admin)
        precoAnual:    450,   // R$
        diasTrial:     7,     // Dias de período de teste gratuito
        githubFotos:   "https://raw.githubusercontent.com/alesh4rk-design/prob-fotos/main/",
        githubApi:     "https://api.github.com/repos/alesh4rk-design/prob-fotos/contents/"
    }

};

// Congela o objeto para evitar modificações acidentais em runtime
Object.freeze(PROB_CONFIG);
Object.freeze(PROB_CONFIG.firebase);
Object.freeze(PROB_CONFIG.admin);
Object.freeze(PROB_CONFIG.sistema);


// ═══════════════════════════════════════════════════════════════
// INSTRUÇÃO IMPORTANTE — Email preso no Firebase Auth
// ---------------------------------------------------------------
// Quando um barbeiro é excluído pelo admin, os dados do Firestore
// são removidos mas a conta no Firebase Auth permanece.
// Para liberar o email para um novo cadastro:
//
// 1. Acesse: console.firebase.google.com
// 2. Projeto pro-b-800da → Authentication → Users
// 3. Encontre o email do barbeiro excluído
// 4. Clique nos 3 pontinhos → Delete account
//
// Após isso o email fica livre para novo cadastro.
// ═══════════════════════════════════════════════════════════════
