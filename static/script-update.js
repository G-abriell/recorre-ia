// Função para mostrar/esconder seções
function showSection(sectionId) {
    const allSections = document.querySelectorAll('.view');
    allSections.forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }
}
