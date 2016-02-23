var mPlace = Backbone.Model.extend({
    urlRoot: '/request/mPlace/',

    defaults: {
        name: "",
        descr: "",
        image: "",
        geometry: {coordinates: []},
        owner: "",
        remote_image: ""
    },

    initialize: function() {
        this.set({area: this.getArea()}, {silent: true});
    },

    validate: function(attrs) {
        var errors = {};
        if (attrs.name.length < 1)
            errors.PLACE_ERR_NAME = ['name'];
        if (attrs.descr.length < 1)
            errors.PLACE_ERR_DESCR = ['descr'];
        if (attrs.geometry.coordinates.length == 0)
            errors.PLACE_ERR_POLY = ['bla'];

        if (_.keys(errors).length > 0)
            return errors;
    },

    getArea: function() {
        var X = [], Y = [];
        _.each(this.get('geometry').coordinates[0], function(el) {
            X.push(el[1]);
            Y.push(el[0]);
        }, this);

        var numPoints = X.length,
            area = 0,
            j = numPoints-1;

        for (var i=0; i<numPoints; i++) {
            area = area +  (X[j]+X[i]) * (Y[j]-Y[i]);
            j = i;
        }
        return Math.abs(area)/2;
    }
});