// Lista central de todos os módulos de menu que queremos carregar.
// O nome da chave será o nome no objeto final. O valor é o caminho do arquivo.
const menuModules = {
    menu: "./menu.js",
    menuAlterador: "./alteradores.js",
    menudown: "./menudown.js",
    menuadm: "./menuadm.js",
    menubn: "./menubn.js",
    menuDono: "./menudono.js",
    menuMembros: "./menumemb.js",
    menuFerramentas: "./ferramentas.js",
    menuSticker: "./menufig.js",
    menuIa: "./menuia.js",
    menuTopCmd: "./topcmd.js",
    menuGold: "./menugold.js"
};

/**
 * Carrega dinamicamente todos os menus listados em menuModules.
 * Valida se cada módulo foi carregado e se possui uma exportação padrão válida.
 * @returns {Promise<Object>} Um objeto contendo todos os menus carregados.
 */
async function loadMenus() {
    const loadedMenus = {};
    const invalidMenus = [];

    // Usamos Promise.all para carregar todos os módulos em paralelo, o que é mais rápido.
    const promises = Object.entries(menuModules).map(async ([name, path]) => {
        try {
            // A importação dinâmica retorna um objeto com a exportação padrão na chave 'default'
            const module = await import(path);
            
            // Validação: O módulo foi carregado e tem uma exportação padrão?
            if (module && module.default) {
                loadedMenus[name] = module.default;
            } else {
                invalidMenus.push(`${name} (não possui exportação padrão)`);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Falha ao carregar o menu '${name}' de ${path}:`, error.message);
            invalidMenus.push(name);
        }
    });

    // Espera todas as importações terminarem
    await Promise.all(promises);

    // Se houver menus inválidos, loga um aviso claro
    if (invalidMenus.length > 0) {
        console.warn(`[${new Date().toISOString()}] AVISO: Os seguintes menus não foram carregados corretamente: ${invalidMenus.join(', ')}.`);
        console.error(`[${new Date().toISOString()}] ERRO CRÍTICO: A inicialização pode estar incompleta.`);
    }

    return loadedMenus;
}

// Carrega os menus e os exporta.
// O 'export default' de um módulo ESM é resolvido apenas uma vez.
// Usamos uma IIAFE (Immediately Invoked Asynchronous Function Expression) para carregar e exportar.
const menus = await loadMenus();

export default menus;