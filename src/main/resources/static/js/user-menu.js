// obsluga rozwijalnego menu uzytkownika
document.addEventListener('DOMContentLoaded', function(){
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    if(userMenuToggle && userDropdownMenu){
        // toggle menu po kliknieciu
        userMenuToggle.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();
            
            userMenuToggle.classList.toggle('active');
            userDropdownMenu.classList.toggle('active');
        });

        // zamkniecie menu po kliknieciu poza nim
        document.addEventListener('click', function(e){
            if(!userMenuToggle.contains(e.target) && !userDropdownMenu.contains(e.target)){
                userMenuToggle.classList.remove('active');
                userDropdownMenu.classList.remove('active');
            }
        });

        // zapobieganie zamknieciu menu po kliknieciu w jego wnetrze
        userDropdownMenu.addEventListener('click', function(e){
            e.stopPropagation();
        });

        // zamkniecie dropdown po kliknieciu w element menu uzytkownika
        userDropdownMenu.querySelectorAll('[data-section]').forEach(item => {
            item.addEventListener('click', () => {
                userDropdownMenu.classList.remove('active');
                userMenuToggle.classList.remove('active');
            });
        });
    }
});
