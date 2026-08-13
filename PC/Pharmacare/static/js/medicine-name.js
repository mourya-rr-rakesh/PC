// Fetch medicine names from database
window.medicineNames = [

"Nimoril Plus",
"Nice",
"Sumo",
"Nicip",
"Gramogly",
"Norflox 400",
"Norflox TZ",
"Dolo 500",
"Dolo 650",
"Calpol 500",
"Calpol 650",
"P 500",
"P 650",
"Zoradol",
"Zoradol P",
"Zoradol SP",
"Zoradol Cold",
"Cheston Cold",
"Aciloc 150",
"Aciloc 300",
"Aciloc RD",
"Omipure 20",
"Oxalgin",
"Esginrin",
"Brufen 400",
"Brufen 600",
"Flagyl 400",
"Entroquinol",
"Metronidazole",
"Metrogyl",
"Neurobion Forte",
"Cynovol 16",
"Albendazole",
"DP Gesic",
"Bactrim DS",
"Combiflam",
"Flexon",
"Aldegesic P",
"P 250",
"Taxim O DT 100",
"Mahacef 200",
"Cefolac DT 50",
"Cefolac 200",
"Disprin",
"Megapen",
"Hifen 50 DT",
"Hifen 100 DT",
"Hifen 200 DT",
"Amcef 200 LB",
"Mypol D",
"Taxim O 50 DT",
"Taxim O 200",
"Monocef O 200",
"Monocef O 100",
"Burpal Kid",
"Omesule DM",
"Rebozen DSR",
"Amoxyclav 625",
"Zincovit",
"Ampilox 500",
"Cavmox 250 DT",
"Mega CV 625",
"Calvam 625",
"Mega CV 375",
"Aristomox CV 625",
"Itmac 200",
"Itmac 100",
"Zerodol P",
"Zerodol SP",
"Zerodol",
"Zerodol Spas",
"Candiforce 100",
"Candiforce 200",
"Omnacortil 5",
"Omnacortil 10",
"Rhumacort",
"Sinarest",
"Deriphyllin Retard 150",
"Perinorm",
"Lomofen Plus",
"A to Z Cold",
"Dilona SP",
"A to Z",
"Megapen 500",
"Asthalin 4",
"Theo Asthalin",
"Cypon",
"Hemfer",
"Bcosules",
"Unienzyme",
"Rebcan DSR",
"Rabmac DSR",
"Rabizo DSR",
"Omee D",
"Omee",
"Aristozyme",
"Pantop DSR",
"Pantop D",
"Pantop 40",
"Gaspaz DS",
"Gaspaz",
"Nimoril Plus",
"Nimulid P",
"Nicip Plus",
"Nise Plus",
"Nimica P",
"Nimucet Plus",

"Sinarest",
"Cheston Cold",
"D-Cold",
"D-Cold Total",
"Coldact",
"Coldact Plus",
"Coldact Flu",
"Flucold",
"Flucold AF",
"Coldin",
"Coldrest",
"Coldrest Plus",
"Coldex",
"Okacet Cold",
"Vicks Action 500",
"Vicks Action 500 Extra",
"Crocin Cold",
"Crocin Cold & Flu",
"Benadryl Cold",
"T-Minic",
"T-Minic Plus",
"T-Minic DS",
"Wikoryl",
"Wikoryl Plus",
"Wikoryl Drops",
"Actifed",
"Alex Cold",
"Alex Cold Plus",
"Grilinctus Cold",
"TusQ-D",
"Cetzine Cold",
"Alerid Cold",
"Montair Cold",
"Levocet Cold",
"Zyncet Cold",
"Cetiriz Cold",
"Allercet Cold",

"Norflox 400",
"Norilet 400",
"Noroxin 400",
"Norcin 400",
"Norbid 400",
"Norflox TZ",
"Norilet TZ",
"Noroxin TZ",
"Norcin TZ",
"Norbid TZ",

"Crocin 500",
"Calpol 500",
"Dolo 500",
"P 500",
"Metacin 500",
"Pacimol 500",
"Pyregesic 500",
"Paracip 500",

"Dolo 650",
"Calpol 650",
"Crocin 650",
"P 650",
"Pacimol 650",
"Pyregesic 650",

"Zoradol P",
"Ketorol P",
"Ketanov P",
"Ketolac P",
"Ketorol Plus",
"Ketorolac P",
"Ketoflam P",
"Ketodol P",
"Ketoheal P",
"Ketogesic P",
"Ketofast P",
"Ketocare P",
"Ketopain P",
"Ketoflex P",
"Ketomed P",
"Ketorolac Plus",
"Ketanov Plus",
"Ketolac Plus",
"Ketoflam Plus",
"Ketodol Plus",

"Zerodol SP",
"Movon SP",
"Hifenac SP",
"Acemiz SP",
"Mahafen SP",
"Aceclo Sera",
"Orthocare SP",
"Seradic SP",
"Aceclo MR Sera",
"Topac SP",
"Fenceta SP",
"Aceclofen SP",
"Acenac SP",
"Rhumafen SP",
"Aceclogesic SP",
"Aceclospas Sera",

"Sinarest",
"Cheston Cold",
"D-Cold Total",
"Vicks Action 500",
"Wikoryl",
"Flucold",
"Coldin",
"Coldact",
"Coldact Plus",
"T-Minic Plus",
"Okacet Cold",
"Cetzine Cold",
"Alex Cold",
"Benadryl Cold",
"Crocin Cold & Flu",
"Alerid Cold",
"Levocet Cold",
"Montair Cold",
"Zyncet Cold",
"Allercet Cold",

"Aciloc 150",
"Rantac 150",
"Zinetac 150",
"Histac 150",
"Ranidom 150",
"Ranipep 150",
"Ulceran 150",
"Rantidine 150",
"Ranicid 150",
"Ranitas 150",
"Raniplex 150",
"Ranidil 150",
"Ranitop 150",
"Ranigard 150",
"Ranitab 150",
"Ranidoc 150",
"Rantidom 150",
"Raniflux 150",
"Ranizol 150",
"Ranocid 150",

"Aciloc 300",
"Rantac 300",
"Zinetac 300",
"Omez 20",
"Omee 20",
"Ocid 20",
"Omepraz 20",
"Omepra 20",

"Novalgin 500",

"Anacin",

"Brufen 400",
"Ibugesic 400",

"Brufen 600",

"Flagyl 400",
"Metrogyl 400",

"Entroquinol",
"Aldezol DF",
"Acrogyl DF",
"Dilomet",
"Metroxan DF",

"Flagyl 400",
"Metrogyl 400",
"Metron 400",
"Metrozyl 400",

"Neurobion Forte",
"Becozym Forte",
"Becosules",
"Polybion Forte",

"Nurokind 1500",
"Mecobal 1500",
"Nervup 1500",
"Methycobal 1500",

"Zentel 400",
"Alworm 400",
"Bandy 400",
"Albend 400",

"DP Gesic",
"Voveran Plus",
"Diclowin Plus",
"Diclomol P",

"Bactrim DS",
"Septran DS",
"Resprim Forte",
"Co-Trimoxazole DS",

"Combiflam",
"Ibugesic Plus",
"Flexon",
"Brufen Plus",

"Flexon",
"Ibugesic Plus",
"Brufen Plus",
"Ibuflam P",

"Zerodol P",
"Hifenac P",
"Movon P",
"Acemiz P",

"Calpol 250",
"Pacimol 250",
"Crocin 250",
"Pyregesic 250",

"Taxim O 100",
"Monocef O 100",
"Mahacef 100",
"Cefolac 100",

"Taxim O 200",
"Monocef O 200",
"Mahacef 200",
"Cefolac 200",

"Cefolac DT 50",
"Taxim O DT 50",
"Mahacef DT 50",
"Monocef DT 50",

"Disprin",
"Ecosprin 325",
"Aspro 325",
"Aspirin 325",

"Ampilox",
"Megapen",
"Ampoxin",
"Bioclox",

"Amcef LB 200",
"Taxim O LB",
"Cefolac LB",
"Monocef O LB",

"Zerodol SP",
"Hifenac SP",
"Movon SP",
"Acemiz SP",

"Ibugesic Plus Kid",
"Brufen P Kid",
"Flexon Kid",
"Ibuflam Kid",

"Omee D",
"Omez D",
"Ocid D",
"Omipure D",

"Rabizo DSR",
"Rabmac DSR",
"Rebozen DSR",
"Rabez DSR",

"Augmentin 625",
"Moxikind CV 625",
"Clavam 625",
"Mega CV 625",

"Zincovit",
"A to Z",
"Becadexamin",
"Supradyn",

"Augmentin 312.5",
"Moxikind CV 312.5",
"Clavam 312.5",
"Mega CV 312.5",

"Canditral 200",
"Itmac 200",
"Sporanox 200",
"Zocon 200",

"Canditral 100",
"Itmac 100",
"Sporanox 100",
"Zocon 100",

"Zerodol",
"Hifenac",
"Movon",
"Acemiz",

"Zerodol Spas",
"Drotin Ace",
"Aceclospas",
"Movon Spas",

"Zocon 100",
"Forcan 100",
"Fluka 100",
"Flunaz 100",

"Zocon 200",
"Forcan 200",
"Fluka 200",
"Flunaz 200",

"Omnacortil 5",
"Wysolone 5",
"Hostacort 5",
"Predmet 5",

"Omnacortil 10",
"Wysolone 10",
"Hostacort 10",
"Predmet 10",

"Defcort 6",
"Zerocort 6",
"Decmax 6",
"Defza 6",

"Deriphyllin",
"Deriphyllin Retard",
"Etophylline Theo",
"Theo Deri",

"Perinorm",
"Metozin",
"Maxolon",
"Emetil",

"Lomotil",
"Lomofen",
"Dipolac",
"Diarex",

"A to Z",
"Supradyn",
"Becadexamin",
"Revital",

"Asthalin 4",
"Salbair 4",
"Ventorlin 4",
"Salbex 4",

"Theo Asthalin",
"Deriphyllin S",
"Salbutheo",
"Theosal",

"Cypon",
"Ciplactin T",
"Trichodine",
"Cypro TC",

"Hemfer",
"Autrin",
"Fefol",
"Livogen",

"Becosules",
"Becozym C Forte",
"Neurobion Forte",
"Polybion C",

"Unienzyme",
"Aristozyme",
"Digizyme",
"Enzar Forte",

"Pantop DSR",
"Pansec DSR",
"Pantocid DSR",
"Pantodac DSR",

"Pantop D",
"Pantocid D",
"Pansec D",
"Pantodac D",

"Pantop 40",
"Pantocid 40",
"Pansec 40",
"Pantodac 40",

"Gaspaz DS",
"Flatuna DS",
"Gasnil DS",
"Gasex DS",

"Gaspaz",
"Flatuna",
"Gasnil",
"Gasex"


];

async function loadMedicineNamesFromDatabase() {
  try {
    console.log('[medicine-name.js] Fetching medicine names from database...');
    const response = await fetch('/medicines', {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('[medicine-name.js] Failed to fetch medicines:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    const medicines = data.medicines || [];
    
    // Extract unique medicine names from database
    const uniqueNames = [...new Set(medicines.map(m => m.name))];
    window.medicineNames = uniqueNames.sort();
    
    console.log('[medicine-name.js] Successfully loaded ' + window.medicineNames.length + ' unique medicine names from database');
    populateMedicineDatalist();
    return true;
  } catch (error) {
    console.error('[medicine-name.js] Error fetching from database:', error);
    return false;
  }
}

function populateMedicineDatalist() {
  const datalist = document.getElementById('medicineNames');
  if (!datalist) {
    console.warn('[medicine-name.js] Datalist element not found');
    return;
  }
  
  datalist.innerHTML = '';
  window.medicineNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  });
  
  console.log('[medicine-name.js] Datalist populated with ' + window.medicineNames.length + ' medicines');
}

// Load medicine names when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    populateMedicineDatalist();
  });
} else {
  populateMedicineDatalist();
}
