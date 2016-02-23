var mEvent = Backbone.Model.extend({
    urlRoot: '/request/mEvent/',

    defaults: {
        name: "",
        descr: "",
        image: {},
        geometry: ""
    },

    validate: function(attrs) {
        var errors = {};
        if (attrs.name.length < 1)
            errors.EVENT_ERR_NAME = ['name'];
        if (attrs.descr.length < 1)
            errors.EVENT_ERR_DESCR = ['descr'];
        if (attrs.dtbegin == null || attrs.dtbegin < new Date().addHours(-2).getTime()/1000)
            errors.DATE_ERR_BEGIN = ['datebegin'];
        if (attrs.dtend == null || attrs.dtend < new Date().addHours(-2).getTime()/1000)
            errors.DATE_ERR_END = ['dateend'];
        if (attrs.dtbegin >= attrs.dtend)
            errors.DATE_ERR_BE = ['dateend', 'datebegin'];

        if (_.keys(errors).length > 0)
            return errors;
    },

    setInActive: function() {
        this.trigger('setInActive');
    },
    setActive: function() {
        this.trigger('setActive');
    }
});