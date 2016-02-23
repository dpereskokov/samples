var ProfileWindow = Backbone.View.extend({
    className: 'acc_left_col',

    events: {
        'mouseenter' : 'show',
        'mouseleave' : 'hide',
        'click .status_edt' : 'openState',
        'click .now_edit' : 'giglet',
        'keypress .now_edit' : 'save'
    },

    initialize: function () {
        $('body').on('click', $.proxy(function(event) {
            this.closeState(event);
        }, this));
        this.template = (this.options.myprofile)?_.template($('#myProfileWindow_tpl').html()):_.template($('#anotherProfileWindow_tpl').html()),
        this.binds();
        this.render();
    },

    binds: function () {
        this.listenTo(this.model, 'change', this.render);
    },

    render: function () {
        this.$el.insertBefore('#content .fixed_content>.clear');
        this.$el.html(this.template(_.extend({}, this.model.toJSON(), Lang)));
        this.delegateEvents();
    },

    show: function() {
        this.$el.find('.profile_window').stop().fadeTo("fast", 1);
    },

    hide: function() {
        this.$el.find('.profile_window').stop().fadeTo("fast", 0.8);
    },

    openState: function (e) {
        this.$el.find('.now_edit').appendTo(e.currentTarget);
        this.$el.find('.now_edit').show("fast", function() {
           this.focus();
        });
        e.stopPropagation();
    },
    closeState: function () {
        this.$el.find('.now_edit').hide("fast");
    },
    save: function (e) {
        if (e.keyCode == 13) {
            this.model.save({status: this.$el.find('.now_edit').val()}, {patch: true, validate: false,
                success: $.proxy(function () {
                    this.closeState();
                }, this)
            })
        }
    },
    giglet: function (e) {
        e.stopPropagation();
    }
});