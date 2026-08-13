// Common medicine compositions for autocomplete suggestions
const compositionNames = [

  "Ibuprofen 200mg",
  "Aspirin 75mg",
  "Amoxicillin 250mg",
  "Ciprofloxacin 500mg",
  "Doxycycline 100mg",
  "Metronidazole 400mg",
  "Azithromycin 250mg",
  "Clindamycin 300mg",
  "Penicillin V 250mg",
  "Cephalexin 500mg",
  "Erythromycin 250mg",
  "Tetracycline 250mg",
  "Vancomycin 500mg",
  "Gentamicin 80mg",
  "Tobramycin 40mg",
  "Neomycin 500mg",
  "Streptomycin 1g",
  "Kanamycin 500mg",
  "Rifampin 300mg",
  "Isoniazid 100mg",
  "Pyrazinamide 500mg",
  "Ethambutol 400mg",
  "Levofloxacin 500mg",
  "Moxifloxacin 400mg",
  "Ofloxacin 200mg",
  "Norfloxacin 400mg",
  "Gemifloxacin 320mg",
  "Sparfloxacin 200mg",
  "Gatifloxacin 400mg",
  "Besifloxacin 0.6%",
  "Enrofloxacin 50mg",
  "Marbofloxacin 80mg",
  "Orbifloxacin 50mg",
  "Difloxacin 100mg",
  "Sarafloxacin 50mg",
  "Danofloxacin 50mg",
  "Ibafloxacin 50mg",
  "Pradofloxacin 25mg",
  "Nalidixic acid 500mg",
  "Piromidic acid 200mg",
  "Oxolinic acid 250mg",
  "Cinoxacin 250mg",
  "Albendazole 400mg",
  "Mebendazole 100mg",
  "Thiabendazole 500mg",
  "Fenbendazole 100mg",
  "Flubendazole 100mg",
  "Triclabendazole 250mg",
  "Praziquantel 600mg",
  "Niclosamide 500mg",
  "Oxamniquine 250mg",
  "Bithionol 500mg",
  "Hycanthone 150mg",
  "Metrifonate 100mg",
  "Trichlorfon 500mg",
  "Haloxon 500mg",
  "Coumaphos 20%",
  "Diazinon 60%",
  "Malathion 5%",
  "Parathion 40%",
  "Chlorpyrifos 20%",
  "Dichlorvos 50%",
  "Phosmet 50%",
  "Fenitrothion 50%",
  "Fenthion 50%",
  "Dimethoate 40%",
  "Omethoate 50%",
  "Formothion 25%",
  "Methamidophos 60%",
  "Acephate 75%",
  "Monocrotophos 36%",
  "Endosulfan 35%",
  "Lindane 1%",
  "Aldrin 30%",
  "Dieldrin 18%",
  "Heptachlor 40%",
  "Chlordane 40%",
  "Toxaphene 60%",
  "Mirex 18%",
  "Kepone 50%",
  "DDT 50%",
  "Methoxychlor 50%",
  "Dicofol 18.5%",
  "Bromopropylate 25%",
  "Tetradifon 15%",
  "Propargite 57%",
  "Fenbutatin oxide 50%",
  "Cyhexatin 50%",
  "Amitraz 12.5%",
  "Fluazuron 5%",
  "Lufenuron 5%",
  "Noviflumuron 10%",
  "Triflumuron 5%",
  "Diflubenzuron 25%",
  "Teflubenzuron 15%",
  "Chlorfluazuron 5%",
  "Hexaflumuron 10%",
  "Flufenoxuron 10%",
  "Buprofezin 25%",
  "Pyriproxyfen 10%",
  "Fenoxycarb 25%",
  "Methoprene 20%",
  "Hydroprene 10%",
  "Kinoprene 20%",
  "Tebufenozide 20%",
  "Methoxyfenozide 24%",
  "Halofenozide 2%",
  "Chromafenozide 5%",
  "Rhodojaponin III 1%",
  "Tebufenpyrad 20%",
  "Fenpyroximate 5%",
  "Pyridaben 20%",
  "Fenazaquin 20%",
  "Pyrimidifen 20%",
  "Acequinocyl 15%",
  "Fluacrypyrim 50%",
  "Bifenazate 24%",
  "Clofentezine 50%",
  "Hexythiazox 10%",
  "Etoxazole 10%",
  "Spinosad 25%",
  "Abamectin 1.8%",
  "Emamectin benzoate 5%",
  "Ivermectin 1%",
  "Selamectin 6%",
  "Doramectin 5%",
  "Eprinomectin 5%",
  "Moxidectin 1%",
  "Milbemycin oxime 2.5%",
  "Milbemectin 1%",
  "Epsiprantel 2.5%",
  "Febantel 75mg",
  "Pyrantel pamoate 144mg",
  "Morantel tartrate 10%",
  "Levamisole 7.5%",
  "Tetramisole 10%",
  "Closantel 5%",
  "Rafoxanide 3%",
  "Oxyclozanide 6%",
  "Nitroxynil 34%",
  "Bunamidine 5%",
  "Phenamidine 2.5%",
  "Isometamidium 1%",
  "Homidium 2%",
  "Quinapyramine 2.5%",
  "Suramin 10%",
  "Melarsoprol 3.6%",
  "Eflornithine 200mg",
  "Pentamidine 300mg",
  "Diminazene 7%",
  "Imidocarb 12%",
  "Halofuginone 1.2%",
  "Robenidine 30%",
  "Diclazuril 0.5%",
  "Toltrazuril 5%",
  "Ponazuril 15%",
  "Clazuril 2.5%",
  "Amprolium 20%",
  "Ethopabate 4%",
  "Sulfadimethoxine 12.5%",
  "Sulfamethazine 10%",
  "Sulfachlorpyridazine 30%",
  "Sulfadiazine 10%",
  "Sulfamerazine 10%",
  "Sulfamethizole 10%",
  "Sulfisoxazole 10%",
  "Sulfamethoxazole 20%",
  "Trimethoprim 4%",
  "Pyrimethamine 0.25%",
  "Sulfalene 0.5%",
  "Sulfadimidine 10%",
  "Sulfaguanidine 10%",
  "Succinylsulfathiazole 10%",
  "Phthalylsulfathiazole 10%",
  "Sulfasalazine 500mg",
  "Mesalazine 400mg",
  "Olsalazine 250mg",
  "Balsalazide 750mg",
  "Sulfapyridine 500mg",
  "Dapsone 100mg",
  "Clofazimine 50mg",
  "Rifampicin 150mg",
  "Rifabutin 150mg",
  "Rifapentine 150mg",
  "Capreomycin 1g",
  "Viomycin 1g",
  "Cycloserine 250mg",
  "Ethionamide 250mg",
  "Prothionamide 250mg",
  "Thioacetazone 150mg",
  "Para-aminosalicylic acid 4g",
  "Bedaquiline 100mg",
  "Delamanid 50mg",
  "Pretomanid 200mg",
  "Linezolid 600mg",
  "Gatifloxacin 400mg",
  "Besifloxacin 0.6%",
  "Nalidixic acid 500mg",
  "Cinoxacin 250mg",
  "Oxolinic acid 250mg",
  "Piromidic acid 200mg",
  "Pipemidic acid 400mg",
  "Rosoxacin 150mg",
  "Flumequine 300mg",
  "Enrofloxacin 50mg",
  "Danofloxacin 50mg",
  "Difloxacin 100mg",
  "Ibafloxacin 50mg",
  "Marbofloxacin 80mg",
  "Orbifloxacin 50mg",
  "Pradofloxacin 25mg",
  "Sarafloxacin 50mg",
  "Tosufloxacin 150mg",
  "Balofloxacin 100mg",
  "Pazufloxacin 500mg",
  "Garenoxacin 400mg",
  "DX-619 100mg",
  "WCK 771 500mg",
  "DC-159a 100mg",
  "NXL101 500mg",
  "NXL104 500mg",
  "CXA-101 500mg",
  "ACH-702 500mg",
  "ACHN-975 500mg",
  "GSK2251052 500mg",
  "TP-434 500mg",
  "ER-119884 500mg",
  "CS-023 500mg",
  "S-649266 500mg",
  "Finafloxacin 500mg",
  "Delafloxacin 450mg",
  "Omadacycline 150mg",
  "Eravacycline 100mg",
  "Sarecycline 100mg",
  "TP-271 100mg",
  "TP-6076 100mg",
  "KBP-7072 100mg",
  "Lefamulin 150mg",
  "Solithromycin 1200mg",
  "Cethromycin 300mg",
  "Telithromycin 400mg",
  "Clarithromycin 250mg",
  "Roxithromycin 150mg",
  "Dirithromycin 250mg",
  "Flurithromycin 250mg",
  "Josamycin 500mg",
  "Midecamycin 400mg",
  "Oleandomycin 500mg",
  "Spiramycin 3MIU",
  "Troleandomycin 250mg",
  "Pirlimycin 50mg",
  "Tiamulin 45%",
  "Valnemulin 50%",
  "Retapamulin 1%",
  "Mupirocin 2%",
  "Fusidic acid 2%",
  "Bacitracin 500IU",
  "Polymyxin B 5000IU",
  "Colistin 1MIU",
  "Teicoplanin 200mg",
  "Telavancin 10mg",
  "Oritavancin 200mg",
  "Dalbavancin 500mg",
  "Rifaximin 200mg",
  "Rifamycin 300mg",
  "Rifalazil 25mg",
  "Rifabutin 150mg",
  "Rifapentine 150mg",
   "Nimesulide 100 mg, Paracetamol 325 mg",
"Nimesulide 100 mg",
"Paracetamol 325 mg, Chlorpheniramine Maleate 2 mg",
"Norfloxacin 400 mg",
"Norfloxacin 400 mg, Tinidazole 600 mg",
"Paracetamol 500 mg",
"Paracetamol 650 mg",
"Ketorolac Tromethamine 10 mg",
"Ketorolac Tromethamine 10 mg, Paracetamol 325 mg",
"Aceclofenac 100 mg, Paracetamol 325 mg, Serratiopeptidase 15 mg",
"Paracetamol 500 mg, Phenylephrine 10 mg, Chlorpheniramine Maleate 2 mg",
"Ranitidine 150 mg",
"Ranitidine 300 mg",
"Ranitidine 150 mg, Domperidone 10 mg",
"Omeprazole 20 mg",
"Metamizole Sodium 500 mg",
"Aspirin 325 mg, Caffeine 30 mg",
"Ibuprofen 400 mg",
"Ibuprofen 600 mg",
"Metronidazole 400 mg",
"Diloxanide Furoate 500 mg, Metronidazole 400 mg",
"Thiamine 10 mg, Riboflavin 10 mg, Pyridoxine 3 mg, Cyanocobalamin 15 mcg, Nicotinamide 45 mg, Calcium Pantothenate 50 mg",
"Methylcobalamin 1500 mcg",
"Albendazole 400 mg",
"Diclofenac Potassium 50 mg, Paracetamol 325 mg",
"Sulfamethoxazole 800 mg, Trimethoprim 160 mg",
"Ibuprofen 400 mg, Paracetamol 325 mg",
"Ibuprofen 400 mg, Paracetamol 500 mg",
"Aceclofenac 100 mg, Paracetamol 325 mg",
"Paracetamol 250 mg",
"Cefixime 100 mg",
"Cefixime 200 mg",
"Cefixime 50 mg",
"Aspirin 325 mg",
"Ampicillin 250 mg, Cloxacillin 250 mg",
"Cefixime 200 mg, Lactic Acid Bacillus",
"Ibuprofen 100 mg, Paracetamol 162.5 mg",
"Omeprazole 20 mg, Domperidone 10 mg",
"Rabeprazole 20 mg, Domperidone 30 mg",
"Amoxicillin 500 mg, Clavulanic Acid 125 mg",
"Multivitamins, Multiminerals, Zinc",
"Amoxicillin 250 mg, Clavulanic Acid 62.5 mg",
"Amoxicillin 250 mg, Clavulanic Acid 125 mg",
"Itraconazole 200 mg",
"Itraconazole 100 mg",
"Aceclofenac 100 mg",
"Aceclofenac 100 mg, Drotaverine 80 mg",
"Fluconazole 100 mg",
"Fluconazole 200 mg",
"Prednisolone 5 mg",
"Prednisolone 10 mg",
"Deflazacort 6 mg",
"Etofylline 115 mg, Theophylline 35 mg",
"Metoclopramide 10 mg",
"Diphenoxylate 2.5 mg, Atropine 0.025 mg",
"Multivitamins, Multiminerals",
"Salbutamol 4 mg",
"Theophylline 100 mg, Salbutamol 2 mg",
"Cyproheptadine 4 mg, Tricholine Citrate 275 mg",
"Ferrous Fumarate 152 mg, Folic Acid 0.5 mg",
"Vitamin B Complex, Vitamin C",
"Fungal Diastase 50 mg, Papain 60 mg",
"Pantoprazole 40 mg, Domperidone 30 mg",
"Pantoprazole 40 mg, Domperidone 10 mg",
"Pantoprazole 40 mg",
"Simethicone 80 mg, Activated Charcoal 250 mg",
"Simethicone 40 mg, Activated Charcoal 125 mg"
  
];

window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('composition');
  const suggestionsBox = document.getElementById('compositionSuggestions');

  if (!input || !suggestionsBox) return;

  // Filter and show suggestions
  function showSuggestions(value) {
    // Extract substring after last comma for filtering
    let inputValue = value;
    const lastCommaIndex = value.lastIndexOf(',');
    if (lastCommaIndex !== -1) {
      inputValue = value.substring(lastCommaIndex + 1);
    }
    inputValue = inputValue.toLowerCase().trim();

    if (inputValue.length === 0) {
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
      return;
    }

    const filtered = compositionNames.filter(name =>
      name.toLowerCase().includes(inputValue)
    ).slice(0, 10); // Limit to 10 suggestions

    if (filtered.length === 0) {
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
      return;
    }

    suggestionsBox.innerHTML = filtered.map(name => `<div class="suggestion-item cursor-pointer px-3 py-1 hover:bg-green-200 dark:hover:bg-gray-600">${name}</div>`).join('');
    suggestionsBox.style.display = 'block';
  }

  // Handle click on suggestion
  suggestionsBox.addEventListener('click', e => {
    if (e.target && e.target.classList.contains('suggestion-item')) {
      // When selecting suggestion: replace the part after last comma with selected composition
      const currentValue = input.value;
      const lastCommaIndex = currentValue.lastIndexOf(',');
      let newValue = '';
      if (lastCommaIndex !== -1) {
        newValue = currentValue.substring(0, lastCommaIndex + 1) + ' ' + e.target.textContent;
      } else {
        newValue = e.target.textContent;
      }
      input.value = newValue.trim();
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
      input.focus();
    }
  });

  // Keyboard navigation for suggestions
  let selectedIndex = -1;
  input.addEventListener('keydown', e => {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items, selectedIndex);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        // Replace after last comma with selected suggestion on Enter too
        const currentValue = input.value;
        const lastCommaIndex = currentValue.lastIndexOf(',');
        let newValue = '';
        if (lastCommaIndex !== -1) {
          newValue = currentValue.substring(0, lastCommaIndex + 1) + ' ' + items[selectedIndex].textContent;
        } else {
          newValue = items[selectedIndex].textContent;
        }
        input.value = newValue.trim();
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none';
        input.focus();
      }
    }
  });

  function updateSelection(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('bg-green-300', 'dark:bg-gray-600');
      } else {
        item.classList.remove('bg-green-300', 'dark:bg-gray-600');
      }
    });
  }

  // Show suggestions on input event
  input.addEventListener('input', e => {
    selectedIndex = -1;
    showSuggestions(e.target.value);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', e => {
    if (e.target !== input && !suggestionsBox.contains(e.target)) {
      suggestionsBox.innerHTML = '';
      suggestionsBox.style.display = 'none';
    }
  });
});

// Make compositionNames available globally for script.js
window.compositionNames = compositionNames;
