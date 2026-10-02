Ext.define('Proxmox.panel.SmsEditPanel', {
    extend: 'Proxmox.panel.InputPanel',
    xtype: 'pmxSmsEditPanel',
    mixins: ['Proxmox.Mixin.CBind'],

    type: 'sms',

    // fields with lists, entered comma separated
    listFields: ['phone', 'template-param'],

    // provider specific settings
    providers: {
        aliyun: {
            appIdLabel: undefined,
            region: 'cn-hangzhou',
        },
        tencent: {
            appIdLabel: 'SDK AppID',
            region: 'ap-guangzhou',
        },
        huawei: {
            appIdLabel: gettext('Sender'),
            region: 'cn-north-4',
        },
    },

    controller: {
        xclass: 'Ext.app.ViewController',

        control: {
            'field[name=provider]': {
                afterrender: (field) => field.fireEvent('change', field, field.getValue()),
                change: 'onProviderChange',
            },
        },

        onProviderChange: function (field, provider) {
            let me = this;
            let view = me.getView();
            let settings = view.providers[provider] ?? {};

            let appId = me.lookup('appId');
            appId.setHidden(!settings.appIdLabel);
            appId.setDisabled(!settings.appIdLabel);
            appId.setFieldLabel(settings.appIdLabel ?? '');
            appId.allowBlank = !settings.appIdLabel;
            appId.validate();

            me.lookup('region').setEmptyText(settings.region ?? Proxmox.Utils.defaultText);
        },
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
            xtype: 'proxmoxKVComboBox',
            name: 'provider',
            fieldLabel: gettext('Provider'),
            allowBlank: false,
            value: 'aliyun',
            comboItems: [
                ['aliyun', gettext('Alibaba Cloud')],
                ['tencent', gettext('Tencent Cloud')],
                ['huawei', gettext('Huawei Cloud')],
            ],
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'access-key',
            fieldLabel: gettext('Access Key'),
            cbind: {
                emptyText: (get) => (!get('isCreate') ? gettext('Unchanged') : ''),
                allowBlank: '{!isCreate}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            inputType: 'password',
            name: 'secret-key',
            fieldLabel: gettext('Secret Key'),
            cbind: {
                emptyText: (get) => (!get('isCreate') ? gettext('Unchanged') : ''),
                allowBlank: '{!isCreate}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            reference: 'appId',
            name: 'app-id',
            hidden: true,
            disabled: true,
            cbind: {
                deleteEmpty: '{!isCreate}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            reference: 'region',
            name: 'region',
            fieldLabel: gettext('Region'),
            emptyText: 'cn-hangzhou',
            cbind: {
                deleteEmpty: '{!isCreate}',
            },
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'phone',
            fieldLabel: gettext('Phone Numbers'),
            allowBlank: false,
            validator: (value) =>
                value
                    .split(/[\s,;]+/)
                    .filter((phone) => phone !== '')
                    .every((phone) => /^\+?[0-9]{5,20}$/.test(phone)) ||
                gettext('Invalid phone number'),
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'sign-name',
            fieldLabel: gettext('Signature'),
            allowBlank: false,
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'template-id',
            fieldLabel: gettext('Template ID'),
            allowBlank: false,
        },
        {
            xtype: 'proxmoxtextfield',
            name: 'template-param',
            fieldLabel: gettext('Template Parameters'),
            emptyText: 'hostname,title',
            validator: (value) =>
                value
                    .split(/[\s,;]+/)
                    .filter((param) => param !== '')
                    .every((param) =>
                        ['title', 'severity', 'hostname', 'type', 'time'].includes(param),
                    ) || gettext('Invalid template parameter'),
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

    onSetValues: function (values) {
        let me = this;

        values.enable = !values.disable;
        delete values.disable;

        for (const field of me.listFields) {
            if (Ext.isArray(values[field])) {
                values[field] = values[field].join(', ');
            }
        }

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

        for (const field of me.listFields) {
            let list = (values[field] ?? '').split(/[\s,;]+/).filter((v) => v !== '');
            if (list.length) {
                values[field] = list;
            } else {
                delete values[field];
                if (!me.isCreate && field === 'template-param') {
                    Proxmox.Utils.assemble_field_data(values, { delete: field });
                }
            }
        }

        return values;
    },
});
