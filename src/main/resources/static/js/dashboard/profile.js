class ProfileModule{
    constructor(){
        this.load();
    }

    // zaladowanie danych uzytkownika
    async load(){
        this.loadPosts();
        this.loadComments();
        this.loadNotes();
    }

    //ladowanie postow uzytkownika
    async loadPosts(){
       
    }

    //ladowanie komentarzy uzytkownika
    async loadComments(){
       
    }

    //ladowanie notatek uzytkownika
    async loadNotes(){
        
    }
}

// eksport klasy do obiektu window, aby dashboard-navigation.js ja widzial
window.ProfileModule = ProfileModule;