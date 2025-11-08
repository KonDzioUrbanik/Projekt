document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.btn-navbar-left');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const sectionName = link.getAttribute('data-section');
            
            // usuniecie active ze wszystkich przyciskow
            navLinks.forEach(l => l.classList.remove('active'));
            
            // dodanie active dla kliknietego przycisku
            link.classList.add('active');
            
            // ukrycie wszystkich sekcji
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // pokazanie wybranej sekcji
            const targetSection = document.getElementById(sectionName);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // zaladowanie danych dla harmonogramu zajec
            if(sectionName === 'schedule'){
                if(!window.scheduleCalendar){
                    window.scheduleCalendar = new ScheduleCalendar();
                } 
                else{
                    window.scheduleCalendar.loadSchedule();
                }
            }

            // zaladowanie innych modulow ponizej
            


        });
    });
});