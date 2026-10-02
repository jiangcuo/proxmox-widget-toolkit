Ext.define('Proxmox.panel.RobotEditPanel', {
    extend: 'Proxmox.panel.InputPanel',
    xtype: 'pmxRobotEditPanel',
    mixins: ['Proxmox.Mixin.CBind'],

    // set by the endpoint edit window, one of 'dingtalk', 'feishu' or 'wecom'
    type: undefined,

    cbindData: function () {
        let me = this;
        return {
            // WeCom robots do not support signed requests
            hasSecret: me.type !== 'wecom',
        };
    },

    items: [
        {
            xtype: 'pmxDisplayEditField',
            name: 'name',
            cbind: {
                value: '{name}',
                editable: '{isCreate}',
            },
            fieldLabel: gettext('Endpoint Name'),
            allowBlank: false,
        },
        {
            xtype: 'proxmoxcheckbox',
            name: 'enable',
            fieldLabel: gettext('Enable'),
            allowBlank: false,
            checked: true,
        },
        {
            xtype: 'proxmoxtextfield',
            fieldLabel: gettext('Webhook URL'),
            name: 'url',
            regex: Proxmox.Utils.httpUrlRegex,
            regexText: gettext('Must be a valid URL'),
            cbind: {
                emptyText: (get) => (!get('isCreate') ? gettext('Unchanged') : ''),
                allowBlank: '{!isCreate}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            inputType: 'password',
            fieldLabel: gettext('Secret'),
            name: 'secret',
            allowBlank: true,
            cbind: {
                emptyText: (get) => (!get('isCreate') ? gettext('Unchanged') : gettext('None')),
                hidden: '{!hasSecret}',
                disabled: '{!hasSecret}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'comment',
            fieldLabel: gettext('Comment'),
            cbind: {
                deleteEmpty: '{!isCreate}',
            },
        },
    ],

    onSetValues: (values) => {
        values.enable = !values.disable;

        delete values.disable;
        return values;
    },

    onGetValues: function (values) {
        let me = this;

        if (values.enable) {
            if (!me.isCreate) {
                Proxmox.Utils.assemble_field_data(values, { delete: 'disable' });
            }
        } else {
            values.disable = 1;
        }

        delete values.enable;

        return values;
    },
});
