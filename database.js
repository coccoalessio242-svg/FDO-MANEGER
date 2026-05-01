const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

function loadDatabase() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
      agenti: {},
      persone: {},
      arresti: {},
      denuncie: {},
      multe: {},
      sequestri: {},
      pda: {},
      nextArrestId: 1,
      nextDenunciaId: 1,
      nextMultaId: 1,
      nextSequestroId: 1,
      nextPdaId: 1
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function addAgente(userId, userName) {
  const db = loadDatabase();
  db.agenti[userId] = {
    nome: userName,
    oreServizio: 0,
    oreTotali: 0,
    inServizio: false,
    timbraInizio: null,
    pdaEmessi: 0,
    arresti: 0,
    multe: 0,
    sequestri: 0,
    createdAt: new Date().toISOString()
  };
  saveDatabase(db);
}

function updateAgente(userId, data) {
  const db = loadDatabase();
  if (db.agenti[userId]) {
    db.agenti[userId] = { ...db.agenti[userId], ...data };
    saveDatabase(db);
  }
}

function getAgente(userId) {
  const db = loadDatabase();
  return db.agenti[userId] || null;
}

function getAllAgenti() {
  const db = loadDatabase();
  return db.agenti || {};
}

function addPersona(nome, cognome, dataNascita) {
  const db = loadDatabase();
  const personaId = `${nome.trim()}-${cognome.trim()}-${dataNascita.trim()}`.toLowerCase();
  
  if (!db.persone[personaId]) {
    db.persone[personaId] = {
      nome,
      cognome,
      dataNascita,
      fedina: 'pulita',
      arresti: [],
      denuncie: [],
      multe: [],
      macchineSequestrate: [],
      pda: null,
      createdAt: new Date().toISOString()
    };
    saveDatabase(db);
  }
  return personaId;
}

function getPersona(nome, cognome, dataNascita) {
  const db = loadDatabase();
  const personaId = `${nome.trim()}-${cognome.trim()}-${dataNascita.trim()}`.toLowerCase();
  return db.persone[personaId] || null;
}

function addArresto(agentiIds, nome, cognome, dataNascita, reati, multa, oggettiSequestrati, oggettiConsegnati, fotoUrl) {
  const db = loadDatabase();
  const arrestId = db.nextArrestId++;
  const personaId = addPersona(nome, cognome, dataNascita);
  
  db.arresti[arrestId] = {
    id: arrestId,
    agenti: agentiIds,
    nome,
    cognome,
    dataNascita,
    reati,
    multa,
    oggettiSequestrati,
    oggettiConsegnati,
    foto: fotoUrl,
    data: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  // Aggiorna persona
  db.persone[personaId].arresti.push(arrestId);
  db.persone[personaId].fedina = 'sporca';
  
  // Aggiorna contatori agenti
  agentiIds.forEach(agenteId => {
    if (db.agenti[agenteId]) {
      db.agenti[agenteId].arresti++;
    }
  });
  
  saveDatabase(db);
  return arrestId;
}

function editArresto(arrestId, data) {
  const db = loadDatabase();
  if (db.arresti[arrestId]) {
    db.arresti[arrestId] = { ...db.arresti[arrestId], ...data };
    saveDatabase(db);
  }
}

function getArresto(arrestId) {
  const db = loadDatabase();
  return db.arresti[arrestId] || null;
}

function addPda(agenteId, nome, cognome, dataNascita, motivo, dataScadenza) {
  const db = loadDatabase();
  const pdaId = db.nextPdaId++;
  const personaId = addPersona(nome, cognome, dataNascita);
  
  // Rimuovi PDA precedente se esiste
  if (db.persone[personaId].pda) {
    delete db.pda[db.persone[personaId].pda];
  }
  
  db.pda[pdaId] = {
    id: pdaId,
    agente: agenteId,
    nome,
    cognome,
    dataNascita,
    motivo,
    dataScadenza,
    data: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  db.persone[personaId].pda = pdaId;
  
  if (db.agenti[agenteId]) {
    db.agenti[agenteId].pdaEmessi++;
  }
  
  saveDatabase(db);
  return pdaId;
}

function editPda(pdaId, data) {
  const db = loadDatabase();
  if (db.pda[pdaId]) {
    db.pda[pdaId] = { ...db.pda[pdaId], ...data };
    saveDatabase(db);
  }
}

function getPda(pdaId) {
  const db = loadDatabase();
  return db.pda[pdaId] || null;
}

function removePda(nome, cognome, dataNascita, motivo) {
  const db = loadDatabase();
  const personaId = `${nome.trim()}-${cognome.trim()}-${dataNascita.trim()}`.toLowerCase();
  
  if (db.persone[personaId]?.pda) {
    const pdaRecord = db.pda[db.persone[personaId].pda];
    delete db.pda[db.persone[personaId].pda];
    db.persone[personaId].pda = null;
    saveDatabase(db);
    return { success: true, pdaRecord, motivo };
  }
  return { success: false };
}

function addDenuncia(nome, cognome, dataNascita, data, reati, chiEspone, proveReato, fotoUrl, linkProve) {
  const db = loadDatabase();
  const denunciaId = db.nextDenunciaId++;
  const personaId = addPersona(nome, cognome, dataNascita);
  
  db.denuncie[denunciaId] = {
    id: denunciaId,
    nome,
    cognome,
    dataNascita,
    data,
    reati,
    chiEspone,
    proveReato,
    foto: fotoUrl || null,
    link: linkProve || null,
    createdAt: new Date().toISOString()
  };
  
  db.persone[personaId].denuncie.push(denunciaId);
  saveDatabase(db);
  return denunciaId;
}

function editDenuncia(denunciaId, data) {
  const db = loadDatabase();
  if (db.denuncie[denunciaId]) {
    db.denuncie[denunciaId] = { ...db.denuncie[denunciaId], ...data };
    saveDatabase(db);
  }
}

function getDenuncia(denunciaId) {
  const db = loadDatabase();
  return db.denuncie[denunciaId] || null;
}

function addMulta(agenteId, nome, cognome, dataNascita, data, reato) {
  const db = loadDatabase();
  const multaId = db.nextMultaId++;
  const personaId = addPersona(nome, cognome, dataNascita);
  
  db.multe[multaId] = {
    id: multaId,
    agente: agenteId,
    nome,
    cognome,
    dataNascita,
    data,
    reato,
    createdAt: new Date().toISOString()
  };
  
  db.persone[personaId].multe.push(multaId);
  
  if (db.agenti[agenteId]) {
    db.agenti[agenteId].multe++;
  }
  
  saveDatabase(db);
  return multaId;
}

function editMulta(multaId, data) {
  const db = loadDatabase();
  if (db.multe[multaId]) {
    db.multe[multaId] = { ...db.multe[multaId], ...data };
    saveDatabase(db);
  }
}

function getMulta(multaId) {
  const db = loadDatabase();
  return db.multe[multaId] || null;
}

function addSequestro(agentiIds, nome, cognome, dataNascita, data, targa, motivo, multa) {
  const db = loadDatabase();
  const sequestroId = db.nextSequestroId++;
  const personaId = addPersona(nome, cognome, dataNascita);
  
  db.sequestri[sequestroId] = {
    id: sequestroId,
    agenti: agentiIds,
    nome,
    cognome,
    dataNascita,
    data,
    targa,
    motivo,
    multa,
    createdAt: new Date().toISOString()
  };
  
  db.persone[personaId].macchineSequestrate.push({
    targa,
    sequestroId,
    data: new Date().toISOString()
  });
  
  agentiIds.forEach(agenteId => {
    if (db.agenti[agenteId]) {
      db.agenti[agenteId].sequestri++;
    }
  });
  
  saveDatabase(db);
  return sequestroId;
}

function editSequestro(sequestroId, data) {
  const db = loadDatabase();
  if (db.sequestri[sequestroId]) {
    db.sequestri[sequestroId] = { ...db.sequestri[sequestroId], ...data };
    saveDatabase(db);
  }
}

function getSequestro(sequestroId) {
  const db = loadDatabase();
  return db.sequestri[sequestroId] || null;
}

function removeSequestro(nome, cognome, dataNascita, targa) {
  const db = loadDatabase();
  const personaId = `${nome.trim()}-${cognome.trim()}-${dataNascita.trim()}`.toLowerCase();
  
  if (db.persone[personaId]) {
    db.persone[personaId].macchineSequestrate = 
      db.persone[personaId].macchineSequestrate.filter(m => m.targa !== targa);
    saveDatabase(db);
    return true;
  }
  return false;
}

function pulisciFedina(nome, cognome, dataNascita) {
  const db = loadDatabase();
  const personaId = `${nome.trim()}-${cognome.trim()}-${dataNascita.trim()}`.toLowerCase();
  
  if (db.persone[personaId]) {
    db.persone[personaId].fedina = 'pulita';
    db.persone[personaId].arresti = [];
    db.persone[personaId].denuncie = [];
    db.persone[personaId].multe = [];
    saveDatabase(db);
    return true;
  }
  return false;
}

module.exports = {
  loadDatabase,
  saveDatabase,
  addAgente,
  updateAgente,
  getAgente,
  getAllAgenti,
  addPersona,
  getPersona,
  addArresto,
  editArresto,
  getArresto,
  addPda,
  editPda,
  getPda,
  removePda,
  addDenuncia,
  editDenuncia,
  getDenuncia,
  addMulta,
  editMulta,
  getMulta,
  addSequestro,
  editSequestro,
  getSequestro,
  removeSequestro,
  pulisciFedina
};
