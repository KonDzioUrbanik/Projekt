document.addEventListener('DOMContentLoaded', () => {
    const leftLinks = document.querySelectorAll('.btn-navbar-left');
    const navLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('.content-section');
    
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const sectionName = link.getAttribute('data-section');

            // jesli link nie jest z lewego menu usuwa active z lewego menu
            if(!link.classList.contains('btn-navbar-left')){
                leftLinks.forEach(l => l.classList.remove('active'));
            }
            //jesli link jest z lewego menu ustawia active na nim
            else{
                leftLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }

            // ukrywanie wszystkich sekcji i pokazanie wybranej
            sections.forEach(section => {
                section.classList.remove('active')
            });

            // pokazanie wybranej sekcji
            const targetSection = document.getElementById(sectionName);
            if(targetSection){
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

            // zaladowanie danych dla profilu uzytkownika
            if (sectionName === 'profile'){
                if(!window.profileModule){
                    window.profileModule = new ProfileModule();
                }
                else{
                    window.profileModule.loadProfile();
                }
            }

            // zaladowanie innych modulow ponizej
        });
    });
});