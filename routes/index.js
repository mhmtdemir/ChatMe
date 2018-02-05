var app = require('express')();
var http = require('http').Server(app);
var io =require('socket.io')(http);
/*app.get('/', function(req, res){
    res.send('<h1>Hello world</h1>');
});*/
// var kullanici_adlari=[];


var mongoose=require('mongoose');
users={};
room={};
offline={};

    mongoose.connect('mongodb://localhost/chat',function (err) {
        if(err){
            console.log(err);

        }
        else{
            console.log('Mongo db baglandı');

        }
    });

var chatDb=mongoose.Schema(

    {
        ad_soyad:{ad:String,soyad:String},
        kullanici_adi: String,
        mesaj:String,
        zaman:{type: Date,default:Date.now()}

    }
);

var ozelChatDb=mongoose.Schema(

    {
        ad_soyad:{ad:String,soyad:String},
        kullanici_adi: String,
        mesaj:String,
        zaman:{type: Date,default:Date.now()},
        alici:String

    }
);
var OdaListesi=mongoose.Schema(

    {
        odaismi: String,
        mesaj:String,
        zaman:{type: Date,default:Date.now()},
        kullanicilar:[String]

    }
);
var gecikmelioda=mongoose.Schema(

    {
        odaismi: String,
        mesaj:String,
        gonderen:String,
        zaman:{type: Date,default:Date.now()},
        alicilar:[String]

    }
);
var Chat=mongoose.model('Mesaj',chatDb);

var odamesaji=mongoose.model('gecikmeliOda',gecikmelioda);

var ozelChat=mongoose.model('ozelChat',ozelChatDb);

var odakayit=mongoose.model('Odalar',OdaListesi);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});




io.on('connection', function(socket){


   //Chat.find({},function (err,docs)
    var query=Chat.find({});
    query.sort('-zaman').limit(8).exec(function (err,docs) {

        if(err) throw err;
        else {
            console.log('Eski mesajlar gönderildi');
            socket.emit('eski mesajlari yukle', docs);
        }
    });


    //KULLANICI GİRİSİ  ICIN
    socket.on('yeni kullanici',function (msg,callback) {
            //if(kullanici_adlari.indexOf(msg)!=-1)
            if(msg in users)
            {
                 callback(false);
            }
            else{
                callback(true);
                socket.kullanici_adlari=msg;
                users[socket.kullanici_adlari]=socket;

                    //DAHA ONCEDEN GONDERİLMİŞ MESAJLARI ALIYOR
                var query2=ozelChat.find({alici:msg});
                query2.sort('-zaman').limit(8).exec(function (err,docs) {

                    if(err) throw err;
                    else {
                        console.log('Ozel mesaj gönderildi:'+docs);
                        //socket.to(msg).emit('ozelmesaj',docs);
                        socket.emit('ozelmesaj', docs);
                    }
                });

                var query3=odamesaji.find({alicilar:msg});
                query3.sort('-zaman').limit(5).exec(function (err,docs2) {
                   if(err)throw err;
                   else{

                       console.log('gecikmeli oda mesajı'+docs2);
                       socket.emit('gecikmeliodamesajı',docs2)
                   }

                });

                //kullanici_adlari.push(socket.kullanici_adlari);
                console.log('kullanici adi ' + msg +" giris yapti");
                io.emit('girisyapti',msg);
                kullanici_guncelle();
            }
    });

    //ODA İSİMLERİ İÇİN
    socket.on('oda ismi',function (oda,kullanicilar,callback) {

        if (oda in room) {
            callback(false);
        }
        else {
            callback(true);
            socket.oda_isimleri = oda;
            room[socket.oda_isimleri] = socket;
            console.log('odaismi ' + oda +" kuruldu");


            /*BURASI ODA MESAJINDA YAPILACAK*/
            var odakayitet=new odakayit({odaismi:oda,kullanicilar:kullanicilar});
            odakayitet.save(function (err) {
                if(err) throw err;
                console.log("oda kyaıt edildi  :" +"oda "+oda+ ' kullanicilar ----:'+kullanicilar[0]+" "+kullanicilar[1]);
                //Mesajı yolluyoruz

                //socket.on(name).('ozel message', {msg: data, isim: socket.kullanici_adlari,alici:name});

            });
            /***************************************************//////////
            oda_guncelle(kullanicilar);
           // io.emit('oda ekle',oda);

        }
    });

//MESAJLAR İÇİN Özel mesaj ve broadcast mesaj

    socket.on('chat message', function(msg,callback){

        var data=msg.trim();
        if(data.substr(0,3)==='/f '){
            data=data.substr(3);
            var ind=data.indexOf(' ');
                if(ind!== -1){
                    var name=data.substring(0,ind);
                    var data=data.substring(ind+1);
                        if(name in users){

                            //sadece ıstenen kullanıcıya gonderıyorum.
                            users[name].emit('whisper', {msg: data, isim: socket.kullanici_adlari});
                            console.log("gonderen "+socket.kullanici_adlari+ ' whisper mesaj ----:'+data +"  ----alici : " +name);
                            //socket.kullanici adları gondereni temsil ediyor
                            // data parcalanmıs mesajı
                            // name ise alıcının ismini

                        }


                        else {
                            var kullanicivarmi=Chat.find({kullanici_adi:name});
                            kullanicivarmi.exec(function (err,docs2){
                                if(err) throw err;
                                else if(docs2.length==0){

                                  console.log("Kullanıcı yok"+"  aranan kullanıcı :"+name+"  "+ "sonuclar "+docs2);
                                  callback("Aranan kullanıcı bulunamadi");

                                }
                                else{

                                    //callback("kullanici var");
                                    /*OZEL MESAJI KAYDEDIYORUM */ /*KULLANICI ONLINE OLUNCA emit EDİCEM*/
                                    var ozelMsg=new ozelChat({mesaj:data,kullanici_adi:socket.kullanici_adlari,alici:name});
                                    ozelMsg.save(function (err) {
                                        if(err) throw err;
                                        console.log("Ozel mesaj kayıt edildi  :" +"gonderen "+socket.kullanici_adlari+ ' OZELmesaj ----:'+data +"  ----alici : " +name);
                                        //Mesajı yolluyoruz

                                        //socket.on(name).('ozel message', {msg: data, isim: socket.kullanici_adlari,alici:name});

                                    });
                                    callback("Kullanıcı online değil ama  meşazınızı aldım!");
                                }
                            });
                        }
                }
                else{
                        callback("/w kullanici_adi ve mesaj girin")
                    }

        }
        /****** GELEN MESAJ /g içeriyor ise */
       else if(data.substr(0,3)==='/g ') {

            data = data.substr(3);
            var index = data.indexOf(' ');
            if (index !== -1) {
                var odaismi = data.substring(0, index); //grup numarası ve /g alınacak
                var data = data.substring(index + 1);

                //ODA AKTİFSE MESAJLARI YOLLA
                if (odaismi in room) {

                    // Oda eger varsa odadakı kullanıcılar cekıp onlara emit etmeliyiz
                    odadaisemesajat(odaismi, data, socket.kullanici_adlari);
                    console.log("Odaya mesaj gıdecek oda" + socket.oda_isimleri + ' grup mesajı ----:' + data + "  ----alici : " + odaismi);

                }
                else {  //ODA VAR AMA AKTIF DEGIL
                    var odavarmi = odakayit.find({odaismi: odaismi},{_id:0},{kullanicilar:1});
                    odavarmi.exec(function (err, docs3) {
                        if (err) throw err;
                        else if (docs3.length == 0) {

                            console.log(+odaismi + "Boyle bir oda  yok");
                            callback("Boyle bir oda  yok");

                        }
                        else {


                            var kullanicilarim = [];
                            for (var i = 0; i < docs3.length; i++) {
                                for (var k = 0; k < docs3[i].kullanicilar.length; k++) {
                                    kullanicilarim[k] = docs3[i].kullanicilar[k];
                                }

                            }

                            //callback("kullanici var");
                            /*ODA MESAJI KAYDEDIYORUM */
                            /*KULLANICILAR ONLINE OLUNCA emit EDİCEM*/
                            for (var i = 0; i < kullanicilarim.length; i++) {
                                var ozelOda = new odamesaji({
                                    mesaj: data,
                                    odaismi: odaismi,
                                    gonderen:socket.kullanici_adlari,
                                    alicilar: kullanicilarim[i]
                                });
                                ozelOda.save(function (err) {
                                    if (err) throw err;
                                    else {


                                        console.log("ODA MESAJI KAYDEDILDI :" + "gonderen " + socket.kullanici_adlari + ' ODAMESAJI ----:' + data + "  ----alici : " + kullanicilarim[i]);
                                        //Mesajı yolluyoruz

                                        //socket.on(name).('ozel message', {msg: data, isim: socket.kullanici_adlari,alici:name});

                                    }

                                });

                            }

                        }
                    });

                }
            }
        }
            else {
                var newMsg = new Chat({mesaj: data, kullanici_adi: socket.kullanici_adlari});
                newMsg.save(function (err) {
                    if (err) throw err;

                    io.emit('chat message', {msg: data, isim: socket.kullanici_adlari});
                    console.log(socket.kullanici_adlari + ' :message: ' + msg);
                });
            }



    });

    function odadaisemesajat(odaismi,mesaj,isimler) { //oda ismini ve mesajı aldık

        users[socket.kullanici_adlari].emit("odamesajıgonder",{msg: mesaj, oda:odaismi,isim: socket.kullanici_adlari});
        var kullanicivarmi=odakayit.find({odaismi:odaismi},{_id: 0},{kullanicilar:1});
        kullanicivarmi.exec(function (err,docs) {
            if(err) throw err;
            else if(docs.length==0){


            }
            else {


                var kullanicilarim = [];
                for (var i = 0; i < docs.length; i++) {
                   for(var k=0;k<docs[i].kullanicilar.length;k++){
                            kullanicilarim[k]=docs[i].kullanicilar[k];
                    }

                }


                console.log("Oda var" + " Oda İsmi :" + odaismi + "  " + "kullanicilari "+ docs[0].kullanicilar +" "+kullanicilarim[0]+"   "+ kullanicilarim[1]);
                for (var i = 0; i < kullanicilarim.length; i++) {

                    //KULLANICILAR ONLINE ISE USERS LISTESINDEDIR VE MESAJLAR EMIT EDILIR
                    if (kullanicilarim[i] in users) {
                        //if(kullaniciadi in users)
                        console.log("kullanıcılar bulundu" + kullanicilarim);

                        users[kullanicilarim[i]].emit("odamesajıgonder", {msg: mesaj, isim: isimler,oda:odaismi});

                    }
                    else if(!(kullanicilarim[i] in users)){
                        var kayit=new odamesaji({odaismi:odaismi,mesaj:mesaj,gonderen:socket.kullanici_adlari,alicilar:kullanicilarim[i]})
                        kayit.save(function (err) {
                                if(err) throw err;
                                else{
                                    console.log(kullanicilarim[i]+" ONLINE DEGIL MESAJI KAYDEETTIM"+odaismi+" "+mesaj+" gonderen "+socket.kullanici_adlari );
                                }
});

                    }

                }
            }

        });

    }







    //CIKIS İSLEMİ
    socket.on('disconnect',function (msg) {
        if(!socket.kullanici_adlari){

                return;
            }

            else{
                delete users[socket.kullanici_adlari];
                console.log(socket.kullanici_adlari +' :çıkıs yaptı ');
                io.emit('cikisyapti',socket.kullanici_adlari);
            // kullanici_adlari.splice(kullanici_adlari.indexOf((socket.kullanici_adlari)),1);
            kullanici_guncelle();
        }
    });

    //Kullanıcı ismini yayınlıyacak
    function kullanici_guncelle() {

        io.emit('kullanici adi',Object.keys(users));
    }
    function oda_guncelle(kullanicilar) {
        io.emit('oda ekle',Object.keys(room),kullanicilar);
       // io.emit('kullanici adi',Object.keys(users));
    }

});


// 3000 PORTUNU DİNLE
http.listen(3000, function(){
    console.log('listening on *:3000');
});