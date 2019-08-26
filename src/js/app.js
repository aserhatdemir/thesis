// const swarmClient = new Erebos.SwarmClient({
const swarmClient = new Erebos.swarm.SwarmClient({
    http: 'https://swarm-gateways.net',
    // http: 'http://localhost:8500',
});

async function downloadFromHash(hash) {
    return await ((await swarmClient.bzz.download(hash)).text());
}


function downloadTextAsFile(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=US-ASCII,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function getPublicKey(param) {
    let optionsPatient = {
        userIds: [{username: param.name, email: param.email}],
        curve: "ed25519",
        passphrase: param.passPhrase
    };

    let keyValues = {
        privateKey: '',
        publicKey: ''
    };


    return openpgp.generateKey(optionsPatient).then(function (key) {
        keyValues.privateKey = key.privateKeyArmored; // '-----BEGIN PGP PRIVATE KEY BLOCK ... '
        keyValues.publicKey = key.publicKeyArmored;   // '-----BEGIN PGP PUBLIC KEY BLOCK ... '
        return keyValues;
    });
}

App = {
    web3Provider: null,
    contracts: {},
    account: 0x0,
    buyerPrivateKey: null,
    rawContent: null,

    init: function () {
        return App.initWeb3();
    },

    initWeb3: function () {
        // initialize web3
        if (typeof web3 !== 'undefined') {
            //reuse the provider of the Web3 object injected by Metamask
            App.web3Provider = web3.currentProvider;
        } else {
            //create a new provider and plug it directly into our local node
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
        }
        web3 = new Web3(App.web3Provider);

        App.displayAccountInfo();

        return App.initContract();
    },

    displayAccountInfo: function () {
        web3.eth.getCoinbase(function (err, account) {
            if (err === null) {
                App.account = account;
                $('#account').text("Account: " + account);
                web3.eth.getBalance(account, function (err, balance) {
                    if (err === null) {
                        $('#accountBalance').text("Account Balance:" + web3.fromWei(balance, "ether") + " ETH");
                    }
                })
            }
        });
    },

    initContract: function () {
        $.getJSON('Purchase.json', function (purchaseArtifact) {
            // get the contract artifact file and use it to instantiate a truffle contract abstraction
            App.contracts.Purchase = TruffleContract(purchaseArtifact);
            // set the provider for our contracts
            App.contracts.Purchase.setProvider(App.web3Provider);
            // listen to events
            App.listenToEvents();

            // retrieve the article from the contract
            return App.reloadContents();
        });
    },

    reloadContents: function () {
        // refresh account information because the balance might have changed
        App.displayAccountInfo();

        // retrieve the article placeholder and clear it
        $('#articlesRow').empty();

        App.contracts.Purchase.deployed().then(function (instance) {
            return instance.getContent();
        }).then(function (article) {
            if (article[0] == 0x0) {
                // no article
                return;
            }

            var price = web3.fromWei(article[5], "ether");

            var state = "state";
            switch (Number(article[6])) {
                case 0:
                    state = "Created";
                    break;
                case 1:
                    state = "Locked";
                    break;
                case 2:
                    state = "Inactive";
                    break;
            }

            // retrieve the article template and fill it
            var articleTemplate = $('#articleTemplate');
            articleTemplate.find('.panel-title').text(article[2]);
            articleTemplate.find('.article-description').text(article[3]);
            articleTemplate.find('.article-demo_hash_address').text(article[4]);
            articleTemplate.find('.article-price').text(price);
            articleTemplate.find('.article-state').text(state);
            articleTemplate.find('.article-content_hash_address').text(article[7]);
            articleTemplate.find('.article-public_key').text(article[8]);
            articleTemplate.find('.btn-buy').attr('data-value', price);
            articleTemplate.find('.btn-uploadContent');

            var seller = article[0];
            if (seller == App.account) {
                seller = "You";
            }
            articleTemplate.find('.article-seller').text(seller);

            // buyer
            var buyer = article[1];
            if (buyer == App.account) {
                buyer = "You";
            } else if (buyer == 0X0) {
                buyer = "No one yet";
            }
            articleTemplate.find('.article-buyer').text(buyer);

            // if(article[0] == App.account || article[1] != 0X0) {
            //   articleTemplate.find('.btn-buy').hide();
            // } else {
            //   articleTemplate.find('.btn-buy').show();
            // }

            //you can abort the sale
            if (article[0] == App.account && state == "Created") {
                articleTemplate.find('.btn-abort').show();
            } else {
                articleTemplate.find('.btn-abort').hide();
            }

            //you can buy the content
            if (article[0] != App.account && state == "Created") {
                articleTemplate.find('.userguide').text("Fill the fields to Generate OpenPGP keys and then Buy the content");
                articleTemplate.find('.btn-buyer-pgp').show();
                articleTemplate.find('.btn-buy').show();
            } else {
                articleTemplate.find('.btn-buyer-pgp').hide();
                articleTemplate.find('.btn-buy').hide();
            }

            //you can upload content
            if (article[0] == App.account && state == "Locked") {
                articleTemplate.find('.userguide').text("Select Content to Encrypt and Upload");
                articleTemplate.find('.btn-uploadContent').show();
                articleTemplate.find('.btn-contentFileSelect').show();
            } else {
                articleTemplate.find('.btn-uploadContent').hide();
                articleTemplate.find('.btn-contentFileSelect').hide();
            }

            //you can download contentweb3.eth.accounts[0]
            if (article[1] == App.account && state == "Locked" && article[7] != "") {
                articleTemplate.find('.userguide').text("Enter passphrase and Select Private Key file to Download the Content");
                document.getElementById("buyerPassPhrase2").type = "text";
                articleTemplate.find('.btn-download').show();
                articleTemplate.find('.btn-priKeyUpload').show();
            } else {
                document.getElementById("buyerPassPhrase2").type = "hidden";
                articleTemplate.find('.btn-download').hide();
                articleTemplate.find('.btn-priKeyUpload').hide();
            }

            //you can confirm received
            if (article[1] == App.account && state == "Locked" && article[7] != "") {
                articleTemplate.find('.btn-confirmReceived').show();
            } else {
                articleTemplate.find('.btn-confirmReceived').hide();
            }



            // add this article
            $('#articlesRow').append(articleTemplate.html());
        }).catch(function (err) {
            console.error(err.message);
        });
    },

    sellContent: function () {
        // retrieve the detail of the article
        var _article_name = $('#article_name').val();
        var _description = $('#article_description').val();
        var _demoHashAddress = $('#article_demo_hash_address').val();
        var _price = web3.toWei(parseFloat($('#article_price').val() || 0), "ether");

        // if ((_article_name.trim() == '') || (_price == 0)) {
            // nothing to sell
            // return false;
        // }

        if ((_article_name.trim() == '')) {
            //nothing to sell
        return false;
        }

        App.contracts.Purchase.deployed().then(function (instance) {
            return instance.sellContent(_article_name, _description, _demoHashAddress, _price, {
                from: App.account,
                value: (2 * _price),
                gas: 500000
            });
        }).then(function (result) {

        }).catch(function (err) {
            console.error(err);
        });
    },

    // listen to events triggered by the contract
    listenToEvents: function () {
        App.contracts.Purchase.deployed().then(function (instance) {
            instance.LogSellContent({}, {}).watch(function (error, event) {
                if (!error) {
                    $("#events").append('<li class="list-group-item">' + event.args._name + ' is now for sale</li>');
                } else {
                    console.error(error);
                }
                App.reloadContents();
            });

            instance.LogBuyContent({}, {}).watch(function (error, event) {
                if (!error) {
                    $("#events").append('<li class="list-group-item">' + event.args._buyer + ' bought ' + event.args._name + '</li>');
                } else {
                    console.error(error);
                }
                App.reloadContents();
            });

            instance.LogUploadContent({}, {}).watch(function (error, event) {
                if (!error) {
                    $("#events").append('<li class="list-group-item">' + event.args._seller + ' uploaded content for ' + event.args._name + ' to following hash address: ' + event.args._contentHashAddress + '</li>');
                } else {
                    console.error(error);
                }
                App.reloadContents();
            });

            instance.LogContentReceived({}, {}).watch(function (error, event) {
                if (!error) {
                    $("#events").append('<li class="list-group-item">' + event.args.buyer + ' confirmed and finalized the purchase for ' + event.args._name + '</li>');
                } else {
                    console.error(error);
                }
                App.reloadContents();
            });

            instance.LogAborted({}, {}).watch(function (error, event) {
                if (!error) {
                    $("#events").append('<li class="list-group-item">' + event.args._seller + ' aborted the sale for ' + event.args._name + '</li>');
                } else {
                    console.error(error);
                }
                App.reloadContents();
            });
        });
    },

    buyContent: async function () {
        event.preventDefault();


        // retrieve the content price
        var _price = 2 * parseFloat($(event.target).data('value'));
        const name = $('#buyerName').val();
        const email = $('#buyerEmail').val();
        const passPhrase = $('#buyerPassPhrase').val();

        var buyerKeyPair = await getPublicKey({name, email, passPhrase});
        const _buyerPublicKey = buyerKeyPair.publicKey;
        const _buyerPrivateKey = buyerKeyPair.privateKey;

        swarmClient.bzz
            .upload(_buyerPublicKey, {contentType: 'text/plain'})
            .then(hash => {
                $('#buyerPrivateKey').val(_buyerPrivateKey);
                downloadTextAsFile($('#articleName').text() + '.pk', _buyerPrivateKey);


                App.contracts.Purchase.deployed().then(function (instance) {
                    return instance.buyContent(hash, {
                        from: App.account,
                        value: web3.toWei(_price, "ether"),
                        gas: 500000
                    });
                }).catch(function (error) {
                    console.error(error);
                });
            })
    },

    uploadContent: function (_contentHashAddress) {
        App.contracts.Purchase.deployed().then(function (instance) {
            return instance.uploadContent(_contentHashAddress, {
                from: App.account,
                gas: 500000
            });
        }).catch(function (error) {
            console.error(error);
        });
    },

    downloadContent: async function () {
        const passPhrase = $('#buyerPassPhrase2').val();
        const publicKeyHash = $('#articlePublicKey').text();
        const contentHash = $('#contentHashAddress').text();
        const publicKey = await downloadFromHash(publicKeyHash);
        const encryptedContent = await downloadFromHash(contentHash);

        const privateKeyObj = openpgp.key.readArmored(this.buyerPrivateKey).keys[0];
        await privateKeyObj.decrypt(passPhrase);

        const optionsProvider = {
            message: openpgp.message.readArmored(encryptedContent),
            publicKeys: openpgp.key.readArmored(publicKey).keys,
            privateKeys: [privateKeyObj]
        };
        const decryptedContent = await openpgp.decrypt(optionsProvider).then(decryptedMessage => {
            return decryptedMessage.data;
        });
        downloadTextAsFile($('#articleName').text() + '.txt', decryptedContent);
        console.log(decryptedContent);

        //download content
    },

    confirmReceived: function () {
        event.preventDefault();

        App.contracts.Purchase.deployed().then(function (instance) {
            return instance.confirmReceived({
                from: App.account,
                gas: 500000
            });
        }).catch(function (error) {
            console.error(error);
        });
    },

    abort: function () {
        event.preventDefault();

        App.contracts.Purchase.deployed().then(function (instance) {
            return instance.abort({
                from: App.account,
                gas: 500000
            });
        }).catch(function (error) {
            console.error(error);
        });
    },

    uploadPrivateKeyHandler: function () {
        const reader = new FileReader();
        const file = document.getElementById("buyerPrivateKeyFile");

        if (file.files.length) {
            reader.onload = (e) => {
                this.buyerPrivateKey = e.target.result;
            }
        }
        reader.readAsBinaryString(file.files[0]);
    },

    uploadRawContent: async function () {
        const reader = new FileReader();
        const file = document.getElementById("fileToUpload");

        if (file.files.length) {
            reader.onload = async e => {
                const txt = e.target.result;
                console.log(txt);

                let articlePublicKeyHash = $('#articlePublicKey').text();
                const articlePublicKey = await ((await swarmClient.bzz.download(articlePublicKeyHash)).text());
                const encryptedArticle = await this.encryptArticle(articlePublicKey, txt);
                const encryptedArticleHash = await swarmClient.bzz.upload(encryptedArticle, {contentType: 'text/plain'});
                this.uploadContent(encryptedArticleHash);
            }
        }
        reader.readAsBinaryString(file.files[0]);


    },


    encryptArticle: function (publicKey, txt) {
        const options = {
            data: txt,
            publicKeys: openpgp.key.readArmored(publicKey).keys,

        };

        return openpgp.encrypt(options).then(cipherText => {
            return cipherText.data;
        })
    }
};

openpgp.initWorker({path: 'node_modules/openpgp/dist/openpgp.worker.js'})

async function testme() {


    let msgRequest = {
        "patient_id": "0005",
        "gender": "female",
        "age_group": "25-30",
        "subject": "Enquiry on Lasek treatment",
        "arrival_from_date": "01-June-2018",
        "arrival_to_date": "10-June-2018",
        "estimated_budget": "100000",
        "currency": "KWR",
        "sentDate": "31-05-2018",
        "message_body": "I would like to visit for a treatment on Lasek."
    };

    let optionsPatient = {
        userIds: [{username: 'patient0001', email: 'johndoe@medipedia.com'}],
        curve: "ed25519",
        passphrase: 'super long and hard to guess secret'
    };

    let patient = {
        privateKey: '',
        publicKey: ''
    };


    let patientKeys = openpgp.generateKey(optionsPatient).then(function (key) {
        patient.privateKey = key.privateKeyArmored; // '-----BEGIN PGP PRIVATE KEY BLOCK ... '
        patient.publicKey = key.publicKeyArmored;   // '-----BEGIN PGP PUBLIC KEY BLOCK ... '
    });


    patientKeys.then(function (res) {

        encryptDecryptFunction(patient.publicKey, patient.privateKey, optionsPatient.passphrase.toString());
    });

    const encryptDecryptFunction = async (patientPubKey, patientPriKey, passphrase) => {

        const privKeyObj = openpgp.key.readArmored(patientPriKey).keys[0];
        await privKeyObj.decrypt(passphrase);

        const optionsPatient = {
            data: JSON.stringify(msgRequest),
            publicKeys: openpgp.key.readArmored(patientPubKey).keys,
            privateKeys: [privKeyObj]
        };

        openpgp.encrypt(optionsPatient).then(cipherText => {
            const encrypted = cipherText.data;// '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'
            console.log(encrypted);
            return encrypted;
        }).then(async encrypted => {
            console.log(encrypted);
            const encryptedIpfsHash = await swarmClient.bzz.upload(encrypted, {contentType: 'text/plain'});
            return encryptedIpfsHash;
        }).then(async hash => {
            const encryptedMessage = await swarmClient.bzz.download(hash);

            return encryptedMessage;
        }).then(encryptedMessage => {
            return encryptedMessage.text();
        }).then(encrypted => {
            const optionsProvider = {
                message: openpgp.message.readArmored(encrypted),
                publicKeys: openpgp.key.readArmored(patientPubKey).keys,
                privateKeys: [privKeyObj]
            };

            openpgp.decrypt(optionsProvider).then(decryptedMessage => {
                console.log(JSON.parse(decryptedMessage.data));
                return decryptedMessage.data
            })

        })

    }
}

$(function () {
    $(window).load(function () {
        App.init();

        // testme();
    });
});
