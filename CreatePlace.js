var CreatePlace = Backbone.View.extend({
    className: 'acc_left_col',
    template: _.template($('#createPlace_tpl').html()),

    childViews: [],

    events: {
        'mouseenter' : 'show',
        'mouseleave' : 'hide'
    },

    initialize: function () {
        this.childViews.push({place: '.cabCreateVal>.image', view: new LoadImage({model: new mLoadImage({paramName: 'Place'}), title: Lang.UPLOADPLACEIMGMSG})});
        this.childViews[0].view.bind('imageLoaded', function(model) {
            this.trigger('imageLoaded', model)
        }, this).bind('faceRecieved', function(model) {
            /*получены миниатюры, можно втсавить в html и обновить маркер.*/
            /* */
        }, this)
        this.button = new Button();
        this.button.bind('click', this.save, this);

        this.address = new AddressAutoComplete({classes: 'cabCreateInput', placeholder: Lang.ADDRPLACE, map: this.options.map.map, nominatim: this.options.nominatim, user: this.options.user});
        this.binds();
        this.render();
    },

    binds: function () {
        this.listenTo(this.model, 'invalid', this.showErrors);
        this.listenTo(this.model, 'invalid', function() {
            this.button.done();
        });
    },


    render: function () {
        this.$el.insertAfter('#content .fixed_content .eventsTypeChoose_place');
        this.$el.html(this.template(_.extend(this.model.toJSON(), Lang)));
        this.$el.find('.button_place').html(this.button.render({classes: 'saveEvent_btn ', title: Lang.CREATE}).$el);
        this.$el.find('.address').html(this.address.render().$el);
        this.delegateEvents();
        this.$el.find('.cabCreateInput').placeholder();
        this.$el.find('.cabCreateTextarea').autosize();

        this.drawnItems = new L.FeatureGroup();
        this.options.map.markerLayers.addLayer(this.drawnItems);
        this.options.map.controls.drawControl = new L.Control.Draw({
            position: 'toprightbottomer',
            draw: {
                polyline: false,
                marker: false,
                circle: false,
                polygon: {
                    showArea: true,
                    allowIntersection: false,
                    shapeOptions: {
                        color: "#587595",
                        weight: 1,
                        opacity: 0.7,
                        fillColor: '#587595',
                        fillOpacity: 0.4
                    }
                },
                rectangle: {
                    shapeOptions: {
                        color: "#587595",
                        weight: 1,
                        opacity: 0.7,
                        fillColor: '#587595',
                        fillOpacity: 0.4
                    }
                }
            },
            edit: {
                featureGroup: this.drawnItems,
                edit: {
                    selectedPathOptions: {
                        color: "#587595",
                        weight: 1,
                        opacity: 0.7,
                        fillColor: '#587595',
                        fillOpacity: 0.4
                    }
                }
            }
        });
        this.options.map.map.off('draw:created').on('draw:created', $.proxy(function (e) {
            var type = e.layerType,
                layer = e.layer;

            if (type === 'marker') {
                layer.bindPopup('A popup!');
            }

            this.drawnItems.addLayer(layer);
        }, this));

        this.options.map.map.addControl(this.options.map.controls.drawControl);
        this.options.map.markerLayers.addTo(this.options.map.map);
        _.first(_.toArray(this.options.map.controls.drawControl._toolbars))._modes.polygon.handler.enable();


        var mappos = new L.latLng(this.options.map.map.getCenter().lat, this.options.map.map.getCenter().lng+(this.options.map.map.getBounds().getWest()-this.options.map.map.getCenter().lng)/3);
        this.options.map.map.panTo(mappos);
        this.trigger('render');
    },

    show: function() {
        this.$el.find('.createEvent_window').stop().fadeTo("fast", 1);
    },

    hide: function() {
        this.$el.find('.createEvent_window').stop().fadeTo("fast", 0.8);
    },

    save: function() {
        this.removeErrors();
        var geometry = [];
        _.each(this.drawnItems.toGeoJSON().features, function(feature){
            geometry.push(L.GeoJSON.invertGeoJSONCoords(feature.geometry.coordinates));
        }, this);
        var hashToSave = {
            name: this.$el.find('.name').val(),
            descr: this.$el.find('.descr').val(),
            imageid: (this.childViews[0].view.model.id)?this.childViews[0].view.model.id:null,
            geometry: {type: 'Polygon', coordinates: geometry}
        };
        if (this.drawnItems.toGeoJSON().features.length > 1)
            geometry.type = 'Multypolygon';
        this.model.save(hashToSave, {
            success: $.proxy(function() {
                this.button.done();
            }, this)
        });
    }
});