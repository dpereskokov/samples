$(function() {
    /*настроим шаблонизатор underscore*/
    _.templateSettings = {
        interpolate: /\{\{([\s\S]+?)\}\}/gim,
        evaluate: /\<\@(.+?)\@\>/gim
    };

    /*настроим require.js*/
    require.config({
        baseUrl: "/js"
    });

    /* настроим отправку токена при любых backbone запросах */
    $.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
        if (app.token) {
            if(decodeURIComponent(options.url).indexOf('?') + 1)
                options.url += '&token='+app.token;
            else
                options.url += '?token='+app.token;
        }
    });

    /* изменим место хранения картинок leaflet */
    L.Icon.Default.imagePath = '/img/map/';

    /*настроим $.cookie*/
    $.cookie.defaults = {expires: 365*20, path: '/'};

    /*Добавим свою логику вывода времени*/
    Date.getFewftDate = function(time, isWritetoday) {
        isWritetoday = isWritetoday||true;
        var dtc;
        var d1 = new Date(time*1000).clearTime(),
            d2 = Date.today();

        /* текущие сутки */
        if ( d1.equals(d2) ) {
            if (isWritetoday)
                dtc = (new Date(time*1000).toString(Lang.L_TODAY + ' ' + Lang.L_V + " HH:mm"));
            else
                dtc = (new Date(time*1000).toString("HH:mm"));
        } else
        /* В этом году (указываем просто дату и месяц) */
        if (new Date(time*1000).between(Date.today().addYears(-1), Date.today()) ) {
            dtc = (new Date(time*1000).toString("d-MMMM " + Lang.L_V + " HH:mm"));
        } else {
            /* В прошлых годах */
            dtc = (new Date(time*1000).toString("d-MMM yyyy"));
        }
        return {ctime: dtc};
    }


    var App = Backbone.Router.extend({
        /* определяется при инициализации */
        token: '',
        /* Определяется конструктором при инициализации */
        models: '',
        /* Определяется конструктором при инициализации */
        collections: '',
        /* Определяется конструктором при инициализации */
        views: '',
        providers: {},
        /*dependencies - указывает какие библиотеки, css, html нужны для определенного роута*/
        dependencies: {},
        /*loadedDependencies - указывает какие библиотеки, css, html уже загружены*/
        loadedDependencies: {js: [], css: [], html: []},
        /*вспомогательный для перередеривания*/
        viewsArr: [],
        /* объект, содержащий ссылки на nominatim */
        nominatimLinks: {
            direct:  'http://nominatim.openstreetmap.org/search?',
            reverse: 'http://nominatim.openstreetmap.org/reverse?'
        },

        tilesLink: 'http://a.tile.openstreetmap.org/{z}/{x}/{y}.png',

        /*дает полный путь к дополнению (css/js/html)*/
        getDependencies: function(dependence) {
            var generateUrl = function (essence, key, version, path) {
                /*базовые пути (что где искать)*/
                var jsUrl = '/js/';
                var cssUrl = '/css/';
                var htmlUrl = '/';

                path = path || '';  /* path like 'folder/' */
                var completeUrl = '';

                switch (essence) {
                    case 'js':
                        completeUrl = jsUrl+path+key+'.js?v='+version;
                        break;
                    case 'css':
                        completeUrl = 'text!'+cssUrl+path+key+'.css?v='+version;
                        break;
                    case 'html':
                        completeUrl = 'text!'+htmlUrl+path+key+'.html?v='+version;
                        break;
                }
                return completeUrl;
            }
            /*описатель версий*/
            var dependencies = {
                /*js*/
                'core-main': generateUrl('js'/*тип*/, 'core-main'/*ключ*/, 8/*version*/),
                'core-default': generateUrl('js', 'core-default', 8),
                'core-account': generateUrl('js', 'core-account', 8),
                'fewft-leaflet': generateUrl('js', 'lib/leaflet.fewft', 8),
                'tipTip': generateUrl('js', 'lib/jquery.tipTip', 8),
                'imgAreaSelect': generateUrl('js', 'lib/jquery.imgareaselect', 8),
                'jqueryui-timepicker': generateUrl('js', 'lib/jquery-ui-timepicker-addon', 8),
                'fileupload': generateUrl('js', 'lib/jquery.fileupload', 8),
                'leflet-draw': generateUrl('js', 'lib/leaflet.draw', 8),

                /*html*/
                'pattern_core-default': generateUrl('html', 'core-default', 5),
                'pattern_core-account': generateUrl('html', 'core-account', 6),
                'pattern_core-main': generateUrl('html', 'core-main', 5),

                /*css*/
                'style_tipTip': generateUrl('css', 'tipTip', 10),
                'style_imgAreaSelect': generateUrl('css', 'imgareaselect-default', 10),
                'style-jqueryui-timepicker': generateUrl('css', 'jquery-ui-timepicker-addon', 11),
                'style-jqueryui': generateUrl('css', 'jquery-ui', 10),
                'style_leflet-draw': generateUrl('css', 'leaflet.draw', 19)
            }

            return (dependencies[dependence]) ? dependencies[dependence] : '';
        },

        init_models: function (app) {
            this.models = {};
            this.app = app;
            this.push = function(name, model, prefix) {
                prefix = prefix || '';
                this.models[prefix+name] = model;
                this.models[prefix+name].set('token', (this.app.token)?(this.app.token):'');
                /* Если вдруг поменялся токен, то выкинем чувачка нафиг из кабинета (как бы закончилась сессия) */
                this.models[prefix+name].bind('change:authorized', function(m) {
                    if (!m.get('authorized'))
                        this.app.navigate('/logout', {trigger: true});
                }, this);
                /* забиндимся на перепрописывания всем моделям нового токена при его изменении (входе) */
                this.app.bind('change_formodels:token', function() {
                    this.models[prefix+name].set({token: this.app.token}, {silent: true});
                }, this);
            }
            this.get = function(name, prefix) {
                prefix = prefix || '';
                return this.models[prefix+name];
            }
            this.app.bind('logouting', function() {
                _.each(_.keys(this.models), function(key) {
                    this.models[key].set(this.models[key].defaults, {silent: true}).trigger('logouting');
                }, this)
            }, this)
        },
        init_collections: function (app) {
            this.collections = {};
            this.app = app;
            this.modelbind = function (model) {
                model.set('token', (this.app.token)?(this.app.token):'');
                model.once('change:authorized', function(m) {
                    if (!m.get('authorized'))
                        this.app.navigate('/logout', {trigger: true});
                }, this);
            };
            this.push = function(name, collection) {
                collection.token = (this.app.token)?(this.app.token):'';
                collection.bind('add', function (model, options) {
                    this.modelbind(model);
                }, this);
                collection.bind('reset', function () {
                    _.each(collection.models, function(model){
                        this.modelbind(model);
                    }, this)
                }, this);
                this.collections[name] = collection;

                /* забиндимся на перепрописывания всем моделям нового токена при его изменении (входе) */
                this.app.bind('change_formodels:token', function() {
                    _.each(collection.models, function(model) {
                        model.set({token: this.app.token}, {silent: true});
                    }, this)
                }, this);
            }
            this.get = function(name) {
                return this.collections[name];
            }
        },

        init_views: function (app) {
            this.views = {};
            this.app = app;
            this.push = function(name, view, prefix) {
                prefix = prefix || '';
                this.views[prefix+name] = view;
            }
            this.get = function(name, prefix) {
                prefix = prefix || '';
                return this.views[prefix+name];
            }
            this.remove = function(name, prefix) {
                prefix = prefix || '';
                if (this.views[prefix+name]) {
                    this.views[prefix+name].remove();
                    this.views[prefix+name].stopListening(this.views[prefix+name].model);
                }
            }
            this.removeAll = function() {
                _.each(_.keys(this.views), function(key) {
                    this.views[key].remove();
                    /*if (this.views[key].childViews) {
                        _.each(this.views[key].childViews, function(key) {
                            key.view.remove();
                        }, this);
                    }*/
                    this.views[key].stopListening(this.views[key].model);
                }, this);
            }
            this.render = function(name, prefix, params) {
                prefix = prefix || '';
                this.views[prefix+name].binds();
                this.views[prefix+name].render(params);
                return this.views[prefix+name];
            }
        },


        setToken: function(token) {
            if (this.token != token) {
                $.cookie('token', token);
                this.token = token;
                this.trigger('change:token');
            }
        },

        removeToken: function () {
            this.token = null;
            $.removeCookie('token');
            this.trigger('remove:token');
        },

        /* навигация по ссылкам */
        linkNavigate: function(target) {
            this.navigate(target.attr('href'), {trigger: true});
        },

        /* запрос местоположения */
        requestGEOLocation: function() {
            if (navigator.geolocation) {
                var user = this.models.get('user');
                navigator.geolocation.getCurrentPosition($.proxy(function(pos) {
                    $.get(this.nominatimLinks.reverse, {
                        format: 'json',
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        zoom: 10
                    }, $.proxy(function(data) {
                        user.set({location: data.address.country + ', ' + data.address.state + ', ' + data.address.city});
                        this.models.get('user').save({geometry: {type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude]}}, {patch: true, validate: false});
                        this.views.get('accountMainMap').model.set({latlng: [pos.coords.latitude, pos.coords.longitude]});
                    }, this))
                }, this));
            }
        },

        initialize: function(){
            /*Создадим backbone навигацию по ссылкам*/
            $('body').on('click', '.navigate', $.proxy(function(e){
                if (this.views.get('accountContainer'))
                    this.views.get('accountContainer').trigger('navigateclick');
                this.trigger('navigateclick', $(e.currentTarget));
                return false;
            },this));
            this.bind('navigateclick', this.linkNavigate, this);



            /* Определим есть ли токен */
            ($.cookie('token') !== null) ? this.setToken($.cookie('token')):false;

            /* Словим событие уничтожения токена и выкенем из кабинета */
            this.bind('remove:token', function() {
                this.navigate('/', {trigger: true});
            }, this);

            /* Создадим объект models, collections и views*/
            this.models = new this.init_models(this);
            this.collections = new this.init_collections(this);
            this.views = new this.init_views(this);

            /*Получим выбранный язык*/
            this.selectedLeng = _.first(_.keys(Language));
            Lang = Language[this.selectedLeng];

            /*Добавми месяца в объект Date*/
            Date.CultureInfo.monthNames = [Lang.L_MONTH_JANS, Lang.L_MONTH_FEBS, Lang.L_MONTH_MARS, Lang.L_MONTH_APRS, Lang.L_MONTH_MAYS, Lang.L_MONTH_JUNS, Lang.L_MONTH_JULS, Lang.L_MONTH_AUGS, Lang.L_MONTH_SEPS, Lang.L_MONTH_OCTS, Lang.L_MONTH_NOVS, Lang.L_MONTH_DECS];


            /*Пропишем какие библиотеки нужны для какого роута*/
            this.dependencies.main = {
                js: [this.getDependencies('core-main'), this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-main'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.remote_reg = {
                js: [],
                css: [],
                html: []
            };
            this.dependencies.about = {
                js: [this.getDependencies('core-main'), this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-main'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.rules = {
                js: [this.getDependencies('core-main'), this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-main'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.logout = {
                js: [this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-default')]
            };
            this.dependencies.notFound = {
                js: [this.getDependencies('core-main'), this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-main'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.fconfigure = {
                js: [this.getDependencies('core-account'), this.getDependencies('core-default')],
                css: [],
                html: [this.getDependencies('pattern_core-account'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.user = {
                js: [this.getDependencies('core-account'), this.getDependencies('core-default'), this.getDependencies('fewft-leaflet')],
                css: [],
                html: [this.getDependencies('pattern_core-account'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.events = {
                js: [this.getDependencies('core-account'), this.getDependencies('core-default'), this.getDependencies('fewft-leaflet'), this.getDependencies('tipTip'), this.getDependencies('imgAreaSelect'), this.getDependencies('jqueryui-timepicker'), this.getDependencies('fileupload')],
                css: [this.getDependencies('style_tipTip'), this.getDependencies('style_imgAreaSelect'), this.getDependencies('style-jqueryui-timepicker'), this.getDependencies('style-jqueryui')],
                html: [this.getDependencies('pattern_core-account'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.places = {
                js: [this.getDependencies('core-account'), this.getDependencies('core-default'), this.getDependencies('fewft-leaflet'), this.getDependencies('leflet-draw'), this.getDependencies('imgAreaSelect'), this.getDependencies('fileupload')],
                css: [this.getDependencies('style_imgAreaSelect'), this.getDependencies('style_leflet-draw')],
                html: [this.getDependencies('pattern_core-account'), this.getDependencies('pattern_core-default')]
            };
            this.dependencies.edit = {
                js: [this.getDependencies('core-account'), this.getDependencies('core-default'), this.getDependencies('fewft-leaflet'), this.getDependencies('imgAreaSelect'), this.getDependencies('fileupload')],
                css: [this.getDependencies('style_imgAreaSelect')],
                html: [this.getDependencies('pattern_core-account'), this.getDependencies('pattern_core-default')]
            };
            this.bind('route', this.onroute, this);

            /*Установим title документа по умолчанию*/
            this.changeTitle();
        },

        routes: {
            /* main page */
            "": "main",
            "about": "about",
            "rules": "rules",

            /*кабинет и все вытекающее*/
            /* события */
            "events": "events",
            "events/:key": "events",

            /*места*/
            "places": "places",
            "places/:key": "places",

            "edit": "edit",

            "fconfigure": "fconfigure",
            "logout": "logout",
            "404": "notFound",

            /*Роут для регистарции через провайдеры Oauth*/
            "remote_reg/:provider/*path": "remote_reg",

            /* роут по умолчанию - пользователь */
            "*id": "user"
        },

        onroute: function (route) {
            this.currentRoute = route;

            /* объявим роуты с которых будет идти редирект на кабинет пользователя при логине*/
            this.off('change:token', null, this).bind('change:token', function() {
                this.trigger('change_formodels:token');
                var location = window.location.pathname;
                var path = 0;
                switch (route) {
                    case 'main':
                        path = 1;
                        break;
                    case 'notFound':
                        path = 1;
                        break;
                    case 'user':
                        path = 2
                        break;
                    default:break;
                }
                (path == 1)?
                    this.navigate('/giglet').navigate('/', {trigger: true}):
                    ((path == 0)?
                        this.navigate('/giglet').navigate('/'+route, {trigger: true}):
                        this.navigate('/giglet').navigate(location, {trigger: true})
                    );
            }, this);

            /* удалим старые элементы представления вьюх в моделе DOM */
            this.off('navigate', null, this).bind('navigate', function() {
                this.views.removeAll();
                /*отчистим языковый массив перерендериваний*/
                this.viewsArr = [];
            },this);


            /* проинициализируем пользователя под которым зашли */
            this.inituser(route);

            /*Сформируем массив для дозагрузки библиотек*/
            var DepLoadClass = function(app) {
                this.js = [];
                this.css = [];
                this.html = [];

                this.isempty = function() {
                    return ((this.js.length == 0) && (this.css.length == 0) && (this.html.length == 0));
                }
            };
            var needToloadArr = new DepLoadClass(this);
            for (dependence in this.dependencies[route]) {
                _.each(this.dependencies[route][dependence], function (subj) {
                    if (!this.loadedDependencies[dependence][subj])
                        needToloadArr[dependence].push(subj);
                }, this);
            }

            if (!needToloadArr.isempty()) {
                var fillLoadDepends = $.proxy(function (route, dependence) {
                    _.each(this.dependencies[route][dependence], function (subj) {
                        this.loadedDependencies[dependence][subj] = true;
                    }, this);
                }, this);
                require(needToloadArr.html, $.proxy(function () {
                    if (arguments.length > 0) {
                        var outputString = '';
                        _.each(arguments, function(argument) {
                            outputString += argument;
                        });
                        $(outputString).appendTo('head');
                    }
                    for (dependence in this.dependencies[route]) {
                        if (dependence == 'html') {
                            fillLoadDepends(route, dependence);
                            break;
                        }
                    }
                    require(needToloadArr.css, $.proxy(function () {
                        if (arguments.length > 0) {
                            var cssString = '';
                            _.each(arguments, function(argument) {
                                cssString += argument;
                            });
                            $("<style>" + cssString + "</style>").appendTo('head');
                        }

                        for (dependence in this.dependencies[route]) {
                            if (dependence == 'css') {
                                fillLoadDepends(route, dependence);
                                break;
                            }
                        }
                        require(needToloadArr.js, $.proxy(function () {
                            for (dependence in this.dependencies[route]) {
                                if (dependence == 'js') {
                                    fillLoadDepends(route, dependence);
                                    break;
                                }
                            }
                            this.trigger('inituser:'+route);
                        }, this));
                    }, this));
                }, this));
            } else
                this.trigger('inituser:'+route);
        },

        mynavigate: function(path) {
            var container = (this.views.get('mainContainer'))?'mainContainer':'accountContainer';
            if (this.views.get(container)) {
                this.views.get(container).$el.animate({
                    opacity: '0'
                },
                {
                    duration: 200,
                    complete: $.proxy(function () {
                        this.views.get(container).$el.css({width: '0px', hright: '0px', left: '50%', top: '20%'});
                        this.trigger(path);
                        this.trigger('navigate');
                        this.views.get(container).$el.animate({
                            left: "0",
                            top: '0',
                            width: '100%',
                            height: 'auto',
                            opacity: '1'
                        }, {
                            duration: 200,
                            complete: $.proxy(function() {
                                /*Пошлем сигнал главному контейнеру о том, что документ готов*/
                                this.views.get(container).$el.attr('style','');
                                (this.views.get('mainContainer'))?this.views.get('mainContainer').trigger('document:ready'):false;
                                (this.views.get('accountContainer'))?this.views.get('accountContainer').trigger('document:ready'):false;
                            }, this)
                        });
                    }, this)
                })
            } else {
                this.trigger(path);
                this.trigger('navigate');
                /*Пошлем сигнал главному контейнеру о том, что документ готов (для главной)*/
                (this.views.get('mainContainer'))?this.views.get('mainContainer').trigger('document:ready'):false;
                (this.views.get('accountContainer'))?this.views.get('accountContainer').trigger('document:ready'):false;
                this.once('viewsBuilded', function() {
                    /*Пошлем сигнал главному контейнеру о том, что документ готов (для кабинета)*/
                    (this.views.get('mainContainer'))?this.views.get('mainContainer').trigger('document:ready'):false;
                    (this.views.get('accountContainer'))?this.views.get('accountContainer').trigger('document:ready'):false;
                }, this)
            }
        },

        remote_reg: function(provider) {
            /*Получим толкины с фб и вк
            * Происходит после клика по кнопке и редиректа с провайдера*/
            this.requireOuath();
            this.once('loaded:providers', function() {
                this.providers[provider].onRedirect();
            });
        },


        about: function () {
            this.once('goroute:about', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.initNeedViews([
                        'mainContainer',
                        'header',
                        'mainFooter',
                        'languageItemsView',
                        'mainAbout'
                    ]);
                    this.changeTitle('TITLE_ABOUT');
                },this);
            }, this)
        },

        rules: function () {
            this.once('goroute:rules', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.initNeedViews([
                        'mainContainer',
                        'header',
                        'mainFooter',
                        'languageItemsView',
                        'mainRules'
                    ]);
                    this.changeTitle('TITLE_RULES');
                }, this);
            }, this)
        },

        main: function() {
            this.once('goroute:main', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    if (this.token) {
                        this.navigate('/'+this.models.get('auth').get('uid'), {trigger: true});
                    } else {
                        this.initNeedViews([
                            'mainContainer',
                            'header',
                            'mainFooter',
                            'languageItemsView',
                            'regUserForm',
                            'regMapView',
                            'mobileApps',
                            'mobileLink'
                        ]);
                        this.changeTitle('TITLE_MAIN');
                    }
                }, this);
            }, this)
        },

        logout: function() {
            this.once('goroute:logout', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.models.get('auth').destroy();
                    this.models.get('auth').unset('id', {silent: true});
                    this.models.get('user').clear({silent: true});
                    this.removeToken();
                    this.trigger('logouting');
                }, this);
            });
        },

        notFound: function() {
            this.once('goroute:notFound', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.initNeedViews([
                        'mainContainer',
                        'header',
                        'notFound',
                        'mainFooter',
                        'languageItemsView'
                    ]);
                    this.changeTitle('TITLE_404');
                }, this);
            }, this)
        },

        fconfigure: function() {
            this.once('goroute:fconfigure', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.initNeedViews([
                        'accountContainer',
                        'header'
                    ]);
                    this.changeTitle('REG_STEPS_TITLE');
                }, this);
            }, this)
        },

        events: function (key) {
            this.off('goroute:events').bind('goroute:events', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    switch (key) {
                        case undefined:
                        case 'my':
                        case 'withme':
                        case 'create':
                            if (this.token == '') {
                                this.navigate('/', {trigger: true});
                                break;
                            }
                            this.initNeedViews([
                                'accountContainer',
                                'header',
                                'mainFooter',
                                'languageItemsView',
                                'accountMainMap',
                                'eventsTypeChoose'
                            ], {user: this.models.get('user'), latlng: this.models.get('user').get('geometry').coordinates, active: key});
                            break;
                        default:
                            var f = $.proxy(function() {
                                this.initNeedViews([
                                    'accountContainer',
                                    'header',
                                    'mainFooter',
                                    'languageItemsView',
                                    'accountMainMap',
                                    'eventProfile'
                                ], {user: this.models.get('user'), latlng: this.currentEvent.get('geometry').coordinates, currentEvent: this.currentEvent});
                            }, this);
                            if (!this.currentEvent)
                                this.currentEvent = new mEvent();
                            if (this.currentEvent.id == key) {
                                f();
                            } else {
                                this.currentEvent.set(this.currentEvent.defaults, {silent: true});
                                this.currentEvent.set({id: key});
                                this.currentEvent.fetch({
                                    success: $.proxy(function() {
                                        f();
                                    }, this),
                                    error: $.proxy(function () {
                                        this.navigate('/404', {trigger: true});
                                    }, this)
                                });
                            }
                            break;
                    }
                }, this);
            }, this)
        },

        places: function (key) {
            this.off('goroute:places').bind('goroute:places', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    switch (key) {
                        case undefined:
                        case 'my':
                        case 'withme':
                        case 'create':
                            this.initNeedViews([
                                'accountContainer',
                                'header',
                                'mainFooter',
                                'languageItemsView',
                                'accountMainMap',
                                'placesTypeChoose'
                            ], {user: this.models.get('user'), latlng: this.models.get('user').get('geometry').coordinates, active: key});
                            break;
                        default:
                            break;
                    }
                }, this);
            }, this)
        },

        edit: function () {
            this.off('goroute:edit').bind('goroute:edit', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    if (this.token == '') {
                        this.navigate('/', {trigger: true});

                    } else {
                        this.initNeedViews([
                            'accountContainer',
                            'header',
                            'mainFooter',
                            'languageItemsView',
                            'accountMainMap',
                            'editProfile'
                        ], {user: this.models.get('user'), latlng: this.models.get('user').get('geometry').coordinates});
                        this.changeTitle('CAB_EDIT');
                    }
                }, this);
            }, this)
        },

        user: function (id) {
            this.off('goroute:user').bind('goroute:user', function() {
                this.off('auth:complete').bind('auth:complete', function(model) {
                    this.once('currentuser:loaded', function(user, isme /*определяет я это или друной пользователь*/) {
                        isme = (isme==undefined)?true:isme;
                        this.changeTitle(user.get('name') + ' ' + user.get('surname'), true);
                        if (!isme) {
                            $.get(this.nominatimLinks.reverse, {
                                format: 'json',
                                lat: user.get('geometry').coordinates[1],
                                lon: user.get('geometry').coordinates[0],
                                zoom: 10
                            }, $.proxy(function(data) {
                                user.set({location: data.address.country + ', ' + data.address.state + ', ' + data.address.city});
                            }, this));
                        }
                        this.initNeedViews([
                            'accountContainer',
                            'header',
                            'mainFooter',
                            'languageItemsView',
                            'accountMainMap',
                            (isme)?'myProfileWindow':'anotherProfileWindow',
                            'tapeWindow'
                        ], {user: user, latlng: user.get('geometry').coordinates, isme: (isme && this.token.length > 0)?'2':((isme)?'1':'0')});
                    }, this);

                    this.userPage = new mUserPage();
                    this.userPage.set({'id': id});
                    this.userPage.fetch({
                        success: $.proxy(function() {
                            if (model.id == this.userPage.get('uid')) {
                                this.trigger('currentuser:loaded', model);
                            }
                            else {
                                this.anotherUser = new mUser();
                                this.anotherUser.set({id: this.userPage.get('uid')});
                                this.anotherUser.fetch({
                                    success: $.proxy(function() {
                                        this.trigger('currentuser:loaded', this.anotherUser, false);
                                    }, this),
                                    error: $.proxy(function () {
                                        this.off('auth:complete').navigate('/404', {trigger: true});
                                    }, this)
                                });
                            }
                        }, this),
                        error: $.proxy(function () {
                            this.off('auth:complete').navigate('/404', {trigger: true});
                        }, this)
                    });
                }, this);
            }, this)
        },


        getuser: function (route) {
            var f = $.proxy(function(model) {
                var authcompl = $.proxy(function() {
                    this.trigger('auth:complete', model);
                });
                this.off('navigate', authcompl, this).bind('navigate', authcompl, this);
                this.mynavigate('goroute:'+route);
            }, this)

            if (this.token) {
                if (this.models.get('user').get('name').length == 0) {
                    this.models.get('user').fetch({
                        success: $.proxy(function() {
                            f(this.models.get('user'));
                        }, this)
                    })
                } else
                    f(this.models.get('user'));
            } else
                f({id: -1});
        },

        inituser: function(route) {
            this.off('inituser:'+route).bind('inituser:'+route, function() {
                var f = $.proxy(function(model, data) {
                    if (!model.get('boundingbox').contains(L.invertCoords(model.get('geometry').coordinates))) {
                        this.requestGEOLocation();
                        model.save({geometry: {type: 'Point', coordinates: [data[0].lon, data[0].lat]}}, {patch: true, validate: false});
                        this.views.get('accountMainMap').model.set({latlng: [data[0].lat, data[0].lon]});
                    }
                }, this);
                if (!this.models.get('user')) {
                    this.models.push('user', new mUser());
                    this.models.get('user').bind('ipgeo:changed', function(model) {
                        if (model.get('geometry') == '') {
                            this.requestGEOLocation();
                            model.save({geometry: model.get('ipgeo')}, {patch: true, validate: false});
                        } else {
                            /* сдлеаем запрос на номинатим, чтобы определить, находится ли текущая точка внутри новой области,
                             * а также выставить пользователю location */
                            $.get(this.nominatimLinks.reverse, {
                                format: 'json',
                                lat: model.get('ipgeo').coordinates[1],
                                lon: model.get('ipgeo').coordinates[0],
                                zoom: 10
                            }, $.proxy(function(data) {
                                model.set({location: data.address.country + ', ' + data.address.state + ', ' + data.address.city});
                                /* сделаем еще один запрос на номинатим чтобы определить находится ли ткушее местоположение
                                 * чувачка в области текущего ip адреса */
                                $.get(this.nominatimLinks.direct, {
                                    format: 'json',
                                    limit: 1,
                                    city: data.address.city,
                                    state: data.address.state,
                                    country: data.address.country
                                }, $.proxy(function(data) {
                                    model.set({boundingbox: new L.LatLngBounds([data[0].boundingbox[1],data[0].boundingbox[2]], [data[0].boundingbox[0], data[0].boundingbox[3]])});
                                    f(model, data);
                                }, this))
                            }, this))
                        }
                    }, this);
                }
                if (!this.models.get('auth'))
                    this.models.push('auth', new mAuth());
                if (this.token) {
                    if (this.models.get('user').id)
                        this.getuser(route);
                    else {
                        this.models.get('auth').set({id: this.token},{silent:true});
                        if (!this.models.get('auth').get('uid')) {
                            this.models.get('auth').fetch({
                                    success: $.proxy(function(model, response) {
                                        this.models.get('user').set({id: model.get('uid')});
                                        this.getuser(route);
                                    }, this),
                                    error: $.proxy(function() {
                                        this.removeToken();
                                    }, this)}
                            );
                        } else {
                            this.models.get('user').set({id: this.models.get('auth').get('uid')});
                            this.getuser(route);
                        }
                    }
                } else
                    this.getuser(route);
            }, this)
        },

        initNeedViews: function (views, params) {
            _.each(views, function(view) {
                switch (view) {
                    case 'notFound':
                        if (this.views.get('notFound'))
                            this.views.render('notFound');
                        else
                            this.views.push('notFound', new NotFound());
                        this.viewsArr.push(this.views.get('notFound'));
                        break;

                    /* Все по главной */
                    case 'mainLogo':
                        if (this.views.get('mainLogo'))
                            this.views.render('mainLogo');
                        else
                            this.views.push('mainLogo', new MainLogo());
                        this.viewsArr.push(this.views.get('mainLogo'));
                        break;
                    case 'regUserForm':
                        if (this.views.get('regUserForm'))
                            this.views.render('regUserForm');
                        else {
                            this.views.push('regUserForm', new RegUserForm({model: this.models.get('user')}));
                            this.views.get('regUserForm').bind('remote_reg:click', function (provider) {
                                this.providers[provider].auth();
                            }, this);
                            this.models.get('user').bind('reg:done', function (model) {
                                /* залогинимся под новым пользователем */
                                this.views.get('login').login(null, {email: model.get('email'), pass: model.get('pass')});
                            }, this)
                            this.requireOuath();
                        };
                        this.viewsArr.push(this.views.get('regUserForm'));
                        break;
                    case 'mobileApps':
                        if (this.views.get('mobileApps'))
                            this.views.render('mobileApps');
                        else
                            this.views.push('mobileApps', new MobileApps());
                        this.viewsArr.push(this.views.get('mobileApps'));
                        break;
                    case 'mobileLink':
                        if (this.views.get('mobileLink'))
                            this.views.render('mobileLink');
                        else {
                            this.views.push('mobileLink', new MobileLink());
                            this.views.get('mobileLink').bind('click', function() {
                                this.views.get('mobileApps').trigger('open');
                            }, this);
                        };
                        this.viewsArr.push(this.views.get('mobileLink'));
                        break;
                    case 'regMapView':
                        if (this.views.get('regMapView')) {
                            this.views.render('regMapView');
                            this.viewsArr.push(this.views.get('regMapView'));
                        }
                        else {
                            this.models.push('regMap', new mMap({tiles: this.tilesLink}));
                            this.views.push('regMapView', new MapView({model: this.models.get('regMap')}));
                            this.viewsArr.push(this.views.get('regMapView'));
                        };
                        break;
                    case 'mainContainer':
                        if (this.views.get('mainContainer'))
                            this.views.render('mainContainer');
                        else
                            this.views.push('mainContainer', new MainContainer());
                        this.viewsArr.push(this.views.get('mainContainer'));
                        break;
                    case 'header':
                        if (this.token) {
                            if (this.views.get('accountHeader')) {
                                this.views.render('accountHeader');
                                this.views.render('headerMenuRight');
                            }
                            else {
                                this.views.push('accountHeader', new AccountHeader());
                                this.views.push('headerMenuRight', new HeaderMenuRight({model: this.models.get('user')}));
                                this.views.get('headerMenuRight').bind('click_link', function(target) {
                                    this.trigger('navigateclick', target);
                                }, this)
                            }
                            this.viewsArr.push(this.views.get('accountHeader'));
                            this.viewsArr.push(this.views.get('headerMenuRight'));
                        } else {
                            if (this.views.get('mainHeader')) {
                                this.views.render('mainHeader');
                                this.views.render('login');
                            }
                            else {
                                this.views.push('mainHeader', new MainHeader());
                                this.models.get('auth').bind('token_changed', function () {
                                    this.setToken(this.models.get('auth').id);
                                    this.views.remove('regUserForm');
                                }, this)
                                this.views.push('login', new LoginView({model: this.models.get('auth')}));
                            }
                            this.viewsArr.push(this.views.get('mainHeader'));
                            this.viewsArr.push(this.views.get('login'));
                        }
                        break;
                    case 'mainFooter':
                        if (this.views.get('mainFooter'))
                            this.views.render('mainFooter');
                        else
                            this.views.push('mainFooter', new MainFooter());
                        this.viewsArr.push(this.views.get('mainFooter'));
                        break;
                    case 'languageItemsView':
                        if (this.collections.get('cLanguage')) {
                            this.views.render('languageItemsView');
                            this.views.render('languageChooseItemView');
                        }
                        else {
                            this.collections.push('cLanguage', new cLanguage());
                            /*инициализируем вьюху с боксом языков*/
                            this.views.push('languageItemsView', new LanguageItemsView({collection: this.collections.get('cLanguage')}));
                            /*инициализируем вьюху с выбранным языком в футере*/
                            this.views.push('languageChooseItemView', new LanguageChooseItemView({collection: this.collections.get('cLanguage')}));
                            this.collections.get('cLanguage').fetch({reset: true});
                            /*Забиндимся на изменение языка*/
                            this.collections.get('cLanguage').bind('change:language', this.changeLanguage, this);
                        };
                        this.viewsArr.push(this.views.get('languageItemsView'));
                        this.viewsArr.push(this.views.get('languageChooseItemView'));
                        break;
                    case 'mainAbout':
                        if (this.views.get('mainAbout')) {
                            if (this.models.get('about').isLangChanged(this.selectedLeng))
                                this.models.get('about').chlang(this.selectedLeng);
                            else
                                this.views.render('mainAbout');
                        }
                        else {
                            this.models.push('about', new mAbout());
                            this.views.push('mainAbout', new StaticContent({model: this.models.get('about')}));
                            this.models.get('about').loadHTML();
                        }
                        this.viewsArr.push(this.views.get('mainAbout'));
                        break;
                    case 'mainRules':
                        if (this.views.get('mainRules')) {
                            if (this.models.get('rules').isLangChanged(this.selectedLeng))
                                this.models.get('rules').chlang(this.selectedLeng);
                            else
                                this.views.render('mainRules');
                        }
                        else {
                            this.models.push('rules', new mRules());
                            this.views.push('mainRules', new StaticContent({model: this.models.get('rules')}));
                            this.models.get('rules').loadHTML();
                        }
                        this.viewsArr.push(this.views.get('mainRules'));
                        break;

                    /* Теперь все по аккаунту */
                    case 'accountContainer':
                        if (this.views.get('accountContainer'))
                            this.views.render('accountContainer');
                        else {
                            this.views.push('accountContainer', new AccountContainer());
                            this.views.get('accountContainer').bind('explore', function() {
                                this.views.get('accountMainMap').trigger('explore');
                            }, this);
                            this.views.get('accountContainer').bind('rollBack', function() {
                                this.views.get('accountMainMap').trigger('rollBack');
                            }, this);
                        }
                        this.viewsArr.push(this.views.get('accountContainer'));
                        break;
                    case 'accountMainMap':
                        var isme = params.isme || false;
                        var latlng = params.latlng || [-0.09, 51.505];
                        if (this.views.get('accountMainMap')) {
                            this.views.get('accountMainMap').render(this.currentRoute);
                            this.views.get('accountMainMap').changeDataset(undefined, this.currentRoute, {user: params.user, isme: isme});
                            this.viewsArr.push(this.views.get('accountMainMap'));
                        }
                        else {
                            this.models.push('accMap', new mMap({latlng: L.invertCoords(latlng), tiles: this.tilesLink}));
                            this.views.push('accountMainMap', new AccMainMapView({model: this.models.get('accMap'), user: params.user, isme: isme}));
                            this.views.get('accountMainMap').bind('changeDataset', function (item) {
                                /* зайдем сюда в случае если выбран один из пунктов в выпадающем списке на карте */
                                /* удадим по очереди все окна справа */
                                this.views.remove('shortEventsWindow');
                                switch (item) {
                                    case 'typeDataSelector_events':
                                        this.initNeedViews(['shortEventsWindow']);
                                        break;
                                    case 'typeDataSelector_places':
                                        this.initNeedViews(['allPlaces']);
                                        break;
                                    default:
                                        this.views.get('accountMainMap').model.updateDataset(item, '');
                                        break;
                                }
                            }, this);
                            this.views.get('accountMainMap').changeDataset(undefined, this.currentRoute);
                            this.viewsArr.push(this.views.get('accountMainMap'));
                        };
                        break;
                    case 'myProfileWindow':
                        if (this.views.get('myProfileWindow'))
                            this.views.render('myProfileWindow');
                        else
                            this.views.push('myProfileWindow', new ProfileWindow({model: this.models.get('user'), myprofile: true}));
                        this.viewsArr.push(this.views.get('myProfileWindow'));
                        break;
                    case 'anotherProfileWindow':
                        if (this.views.get('anotherProfileWindow'))
                            this.views.render('anotherProfileWindow');
                        else
                            this.views.push('anotherProfileWindow', new ProfileWindow({model: this.anotherUser, myprofile: false}));
                        this.viewsArr.push(this.views.get('anotherProfileWindow'));
                        break;
                    case 'eventProfile':
                        if (this.views.get('eventProfile'))
                            this.views.render('eventProfile');
                        else
                            this.views.push('eventProfile', new EventProfile({model: params.currentEvent}));
                        this.viewsArr.push(this.views.get('eventProfile'));
                        break;
                    case 'tapeWindow':
                        if (this.views.get('tapeWindow'))
                            this.views.get('tapeWindow').render();
                        else
                            this.views.push('tapeWindow', new TapeWindow({myprofile: params.isme}));
                        this.viewsArr.push(this.views.get('tapeWindow'));
                        break;
                    case 'shortEventsWindow':
                        if (this.collections.get('cEvent'))
                            this.collections.get('cEvent').fetch({reset: true});
                        else {
                            this.collections.push('cEvent', new cEvent({model: new mEvent()}));
                            this.collections.get('cEvent').bind('cEvent:loaded', this.models.get('accMap').updateDataset, this.models.get('accMap'));
                            this.views.push('shortEventsWindow', new ShortEventsWindow({collection: this.collections.get('cEvent'), map: this.views.get('accountMainMap')}));
                            this.collections.get('cEvent').fetch({reset: true});
                        };
                        this.viewsArr.push(this.views.get('shortEventsWindow'));
                        break;
                    case 'allPlaces':
                        if (this.collections.get('cPlaces'))
                            this.collections.get('cPlaces').getPlaces({reset: true, data: {
                                bounds: this.views.get('accountMainMap').map.getBounds(),
                                zoom: this.views.get('accountMainMap').map.getZoom(),
                                map: this.views.get('accountMainMap').map
                            }});
                        else {
                            this.collections.push('cPlaces', new cPlace({model: new mPlace()}));
                            this.collections.get('cPlaces').bind('cPlace:loaded', this.models.get('accMap').updateDataset, this.models.get('accMap'));
                            this.views.get('accountMainMap').bind('getPlaces', function() {
                                this.collections.get('cPlaces').getPlaces({reset: true,
                                    data: {
                                        bounds: this.views.get('accountMainMap').map.getBounds(),
                                        zoom: this.views.get('accountMainMap').map.getZoom(),
                                        map: this.views.get('accountMainMap').map
                                    }
                                });
                            }, this);

                            var bounds = this.views.get('accountMainMap').map.getBounds();
                            this.collections.get('cPlaces').getPlaces({reset: true, data: {
                                bounds: this.views.get('accountMainMap').map.getBounds(),
                                zoom: this.views.get('accountMainMap').map.getZoom(),
                                map: this.views.get('accountMainMap').map
                            }});
                        };
                        //this.viewsArr.push(this.views.get('shortEventsWindow'));
                        break;
                    case 'eventsTypeChoose':
                        if (this.views.get('eventsTypeChoose'))
                            this.views.render('eventsTypeChoose', '', params);
                        else {
                            this.views.push('eventsTypeChoose', new EventsTypeChoose());
                            this.views.get('eventsTypeChoose').remove = $.proxy(function () {
                                this.views.get('eventsTypeChoose').$el.remove();
                                this.views.get('accountMainMap').markerLayers.clearLayers();
                                this.views.get('eventsTypeChoose').stopListening();
                                return this.views.get('eventsTypeChoose');
                            }, this);
                            this.views.get('eventsTypeChoose').bind('menuchange', function(menu) {
                                /* удалим ненужные вьюхи при переключении */
                                this.views.get('accountMainMap').markerLayers.clearLayers();
                                this.views.remove('createEvent');
                                this.navigate('/events/'+menu, {trigger: false});
                                switch (menu){
                                    case 'create':
                                        this.initNeedViews(['createEvent']);
                                        this.changeTitle('CAB_CREEVE');
                                        break;
                                    case 'withme':
                                        this.changeTitle('CAB_WITHMEEVENTS');
                                        break;
                                    case 'my':
                                        this.changeTitle('CAB_MYEVENTS');
                                        break;
                                    default:
                                        break;
                                }
                            }, this);
                            this.views.render('eventsTypeChoose', '', params);
                        }
                        this.viewsArr.push(this.views.get('eventsTypeChoose'));
                        break;
                    case 'createEvent':
                        if (this.views.get('createEvent'))
                            this.views.render('createEvent');
                        else {
                            var m = new mEvent();
                            this.views.push('createEvent', new CreateEvent({model: m, map: this.views.get('accountMainMap'), nominatim: this.nominatimLinks, user: this.models.get('user')}));
                            this.views.get('createEvent').bind('choosePlace', function(latLng) {
                                this.initNeedViews(['choosePlaceEvent']);
                                this.collections.get('cEventPlace').fetch({
                                    reset: true,
                                    data: 'json='+JSON.stringify({latlng: latLng})
                                });
                            }, this);
                            this.views.get('createEvent').bind('imageLoaded', function(model) {
                                this.initNeedViews(['imageSelectArea']);
                                this.views.get('imageSelectArea').setModel(model);
                            }, this);
                            this.views.get('createEvent').bind('created', function(id) {
                                this.navigate('/events/'+id, {trigger: true});
                            }, this);
                        }
                        this.viewsArr.push(this.views.get('createEvent'));
                        break;
                    case 'placesTypeChoose':
                        if (this.views.get('placesTypeChoose'))
                            this.views.render('placesTypeChoose', '', params);
                        else {
                            this.views.push('placesTypeChoose', new PlacesTypeChoose());
                            this.views.get('placesTypeChoose').remove = $.proxy(function () {
                                this.views.get('placesTypeChoose').$el.remove();
                                this.views.get('accountMainMap').markerLayers.clearLayers();
                                this.views.get('placesTypeChoose').stopListening();
                                return this.views.get('placesTypeChoose');
                            }, this);
                            this.views.get('placesTypeChoose').bind('menuchange', function(menu) {
                                /* удалим ненужные вьюхи при переключении */
                                if (this.views.get('accountMainMap').controls.drawControl)
                                    if (this.views.get('accountMainMap').controls.drawControl.getContainer()) {
                                        this.views.get('accountMainMap').controls.drawControl.removeFrom(this.views.get('accountMainMap').map);
                                        this.views.get('accountMainMap').controls.drawControl = undefined;
                                    }
                                this.views.get('accountMainMap').markerLayers.clearLayers();
                                this.views.remove('createPlace');
                                this.navigate('/places/'+menu, {trigger: false});
                                switch (menu){
                                    case 'create':
                                        this.initNeedViews(['createPlace']);
                                        this.changeTitle('CAB_CREPLA');
                                        break;
                                    case 'withme':
                                        this.changeTitle('CAB_WITHMEPLACES');
                                        break;
                                    case 'my':
                                        this.changeTitle('CAB_MYPLACES');
                                        break;
                                    default:
                                        break;
                                }
                            }, this);
                            this.views.render('placesTypeChoose', '', params);
                        }
                        this.viewsArr.push(this.views.get('placesTypeChoose'));
                        break;
                    case 'createPlace':
                        if (this.views.get('createPlace'))
                            this.views.render('createPlace');
                        else {
                            var m = new mPlace();
                            this.views.push('createPlace', new CreatePlace({model: m, map: this.views.get('accountMainMap'), nominatim: this.nominatimLinks, user: this.models.get('user')}));
                            this.views.get('createPlace').bind('imageLoaded', function(model) {
                                this.initNeedViews(['imageSelectArea']);
                                this.views.get('imageSelectArea').setModel(model);
                            }, this);
                        }
                        this.viewsArr.push(this.views.get('createPlace'));
                        break;
                    case 'editProfile':
                        if (this.views.get('editProfile'))
                            this.views.render('editProfile');
                        else {
                            this.views.push('editProfile', new EditProfile({model: this.models.get('user'), map: this.views.get('accountMainMap'), nominatim: this.nominatimLinks}));
                            this.views.get('editProfile').bind('imageLoaded', function(model) {
                                this.initNeedViews(['imageSelectArea']);
                                this.views.get('imageSelectArea').setModel(model);
                            }, this);
                        }
                        this.viewsArr.push(this.views.get('editProfile'));
                        break;
                    case 'imageSelectArea':
                        if (this.views.get('imageSelectArea'))
                            this.views.render('imageSelectArea');
                        else
                            this.views.push('imageSelectArea', new ImageSelectArea());
                        this.viewsArr.push(this.views.get('imageSelectArea'));
                        break;
                    case 'choosePlaceEvent':
                        if (this.views.get('choosePlaceEvent'))
                            this.views.render('choosePlaceEvent');
                        else {
                            this.collections.push('cEventPlace', new cPlace());
                            this.views.push('choosePlaceEvent', new ChoosePlaceEvent({collection: this.collections.get('cEventPlace'), map: this.views.get('accountMainMap').map}));
                        }
                        this.viewsArr.push(this.views.get('choosePlaceEvent'));
                        break;
                    default:break;

                }
            }, this);
            this.trigger('viewsBuilded');
        },

        requireOuath: function () {
            /*Заинициализируем все интерфейсы Oauth*/
            require(['lib/backbone.oauth'], $.proxy(function () {
                require(['lib/backbone.oauth.providers'], $.proxy(function() {
                    this.providers.vk = new Backbone.OAuth(Backbone.OAuth.configs.Vk);
                    this.providers.fb = new Backbone.OAuth(Backbone.OAuth.configs.Facebook);
                    this.trigger('loaded:providers');
                    this.bind('remote_reg:accept', function(options) {
                        this.models.get('user').trigger('remote_reg:accept', options);
                    }, this);
                }, this));
            }, this));
        },

        changeTitle: function(title, notLang) {
            notlang = notLang || false;
            if (typeof(title) == 'undefined') {
                if (!this.pageTitle)
                    this.pageTitle = 'TITLE_MAIN';
            } else
            {
                this.pageTitle = title;
            }
            if (this.pageTitle != 'TITLE_MAIN')
                document.title = (notLang)?Lang['TITLE_MAIN'] + ' - ' + this.pageTitle:Lang['TITLE_MAIN'] + ' - ' + Lang[this.pageTitle];
            else
                document.title = Lang[this.pageTitle];
        },

        changeLanguage: function(model) {
            this.selectedLeng = model.get("name");
            var chlang = $.proxy(function () {
                Lang = Language[this.selectedLeng];
                _.each(this.viewsArr, function(view) {
                    view.render();
                    /*обновим статические страницы*/
                    view.trigger('change:language', this.selectedLeng)
                }, this);

                /* установим языковые переменные для плагина рисования полигонов */
                L.drawLocal = {
                    draw: {
                        toolbar: {
                            actions: {
                                title: Lang.L_DRAW_TOOLBAR_ACTIONS_TITLE,
                                text: Lang.L_DRAW_TOOLBAR_ACTIONS_TEXT
                            },
                            buttons: {
                                polyline: Lang.L_DRAW_TOOLBAR_BUTTONS_POLYLINE,
                                polygon: Lang.L_DRAW_TOOLBAR_BUTTONS_POLYGON,
                                rectangle: Lang.L_DRAW_TOOLBAR_BUTTONS_RECTANGLE,
                                circle: Lang.L_DRAW_TOOLBAR_BUTTONS_CIRCLE,
                                marker: Lang.L_DRAW_TOOLBAR_BUTTONS_MARKER
                            }
                        },
                        handlers: {
                            circle: {
                                tooltip: {
                                    start: Lang.L_DRAW_HANDLERS_CIRCLE_TOOLTIP
                                }
                            },
                            marker: {
                                tooltip: {
                                    start: Lang.L_DRAW_HANDLERS_MARKER_TOOLTIP
                                }
                            },
                            polygon: {
                                tooltip: {
                                    start: Lang.L_DRAW_HANDLERS_POLYGON_TOOLTIP_START,
                                    cont: Lang.L_DRAW_HANDLERS_POLYGON_TOOLTIP_CONT,
                                    end: Lang.L_DRAW_HANDLERS_POLYGON_TOOLTIP_END
                                }
                            },
                            polyline: {
                                error: Lang.L_DRAW_ERROR,
                                tooltip: {
                                    start: Lang.L_DRAW_HANDLERS_POLYLINE_TOOLTIP_START,
                                    cont: Lang.L_DRAW_HANDLERS_POLYLINE_TOOLTIP_CONT,
                                    end: Lang.L_DRAW_HANDLERS_POLYLINE_TOOLTIP_END
                                }
                            },
                            rectangle: {
                                tooltip: {
                                    start: Lang.L_DRAW_HANDLERS_RECTANGLE_TOOLTIP
                                }
                            },
                            simpleshape: {
                                tooltip: {
                                    end: Lang.L_DRAW_HANDLERS_SIMPLESHAPE_TOOLTIP
                                }
                            }
                        }
                    },
                    edit: {
                        toolbar: {
                            actions: {
                                save: {
                                    title: Lang.L_EDIT_TOOLBAR_ACTIONS_SAVE_TITLE,
                                    text: Lang.L_EDIT_TOOLBAR_ACTIONS_SAVE_TEXT
                                },
                                cancel: {
                                    title: Lang.L_EDIT_TOOLBAR_ACTIONS_CANCEL_TITLE,
                                    text: Lang.L_EDIT_TOOLBAR_ACTIONS_CANCEL_TEXT
                                }
                            },
                            buttons: {
                                edit: Lang.L_EDIT_TOOLBAR_BUTTONS_EDIT,
                                remove: Lang.L_EDIT_TOOLBAR_BUTTONS_REMOVE
                            }
                        },
                        handlers: {
                            edit: {
                                tooltip: {
                                    text: Lang.L_EDIT_HANDLERS_EDIT_TOOLTIP_TEXT,
                                    subtext: Lang.L_EDIT_HANDLERS_EDIT_TOOLTIP_SUBTEXT
                                }
                            },
                            remove: {
                                tooltip: {
                                    text: Lang.L_EDIT_HANDLERS_REMOVE_TOOLTIP_TEXT
                                }
                            }
                        }
                    }
                };

                /*Пошлем сигнал главному контейнеру о том, что документ готов*/
                (this.views.get('mainContainer'))?this.views.get('mainContainer').trigger('document:ready'):false;
                (this.views.get('accountContainer'))?this.views.get('accountContainer').trigger('document:ready'):false;
                this.changeTitle();
            },this);
            if (!Language[this.selectedLeng]) {
                require(['lang/'+this.selectedLeng], function() {
                    chlang();
                });
            } else {
                chlang();
            }
        }
    });

    app = new App();
    Backbone.history.start({pushState: true});
});
