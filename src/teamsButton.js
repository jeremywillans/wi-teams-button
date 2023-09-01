/* eslint-disable no-use-before-define */
//
// TeamsButton Module
//

// eslint-disable-next-line object-curly-newline
const { cleanEnv, str, bool, num, json } = require('envalid');
const logger = require('./logger')(__filename.slice(__dirname.length + 1, -3));

// Process ENV Parameters
const e = cleanEnv(process.env, {
  LOG_DETAILED: bool({ default: true }),
  LOG_UNKNOWN_RESPONSES: bool({ default: false, devDefault: true }),
  TB_CUSTOMER_TENANT: str({ devDefault: 'acme@m.webex.com' }),
  TB_CUSTOMER_TEXT: str({ default: 'Internal Scheduled Meeting', devDefault: 'ACME Scheduled Meeting' }),
  TB_BUTTON_TEXT: str({ default: 'Microsoft Teams' }),
  TB_PANEL_ID: str({ default: 'teamsjoin' }),
  TB_PANEL_TITLE: str({ default: 'Select Microsoft Teams Meeting' }),
  TB_EXTERNAL_CVI: bool({ default: true }),
  TB_PROMPT_TIMEOUT: num({ default: 90 }),
  TB_DEFAULT_TENANT: str({ default: '@m.webex.com' }),
  TB_HIDE_BUTTON: bool({ default: true }),
  TB_REBUILD_UI: bool({ default: false, devDefault: true }),
  TB_DEFINED_TENANTS: json(
    {
      default: [],
      devDefault: [
        { id: 'btnTenant1', text: 'CompanyA Meeting', tenant: 'company1@m.webex.com' },
        { id: 'btnTenant2', text: 'CompanyC Meeting', tenant: 'teams@company2.onpexip.com' },
      ],
    },
  ),
});

// Define Teams Button options from ENV Parameters
const tbOptions = {
  logDetailed: e.LOG_DETAILED, // enable detailed logging
  logUnknownResponses: e.LOG_UNKNOWN_RESPONSES, // show unknown extension responses in the log
  customerTenant: e.TB_CUSTOMER_TENANT, // Customer CVI tenant
  customerText: e.TB_CUSTOMER_TEXT, // Text shown for Internal meeting option
  buttonText: e.TB_BUTTON_TEXT, // Text to display on button
  panelId: e.TB_PANEL_ID, // Panel identifier
  panelTitle: e.TB_PANEL_TITLE, // Title text for Panel
  externalCVI: e.TB_EXTERNAL_CVI, // Disable to not include external cvi option
  promptTimeout: e.TB_PROMPT_TIMEOUT, // Seconds before prompts are closed
  defaultTenant: e.TB_DEFAULT_TENANT, // Default tenant for external cvi requests
  hideButton: e.TB_HIDE_BUTTON, // Hide default teams button from ui
  rebuildUI: e.TB_REBUILD_UI, // Enable to rebuild panel and button on Integration restart
  definedTenants: e.TB_DEFINED_TENANTS, // 6 defined buttons for common external CVI providers
  // Other Options
  feedbackInternalId: 'feedbackInternalId', // Feedback identifier for vtc conference id prompt
  feedbackConferenceId: 'feedbackConferenceId', // Feedback identifier for vtc conference id prompt
  feedbackTenant: 'feedbackTenant', // Feedback identifier for the cvi tenant prompt
  feedbackMeetingId: 'feedbackMeetingId', // Feedback identifier for meeting id prompt
  feedbackMeetingPassword: 'feedbackMeetingPassword', // Feedback identifier for vtc conference id prompt
  btnInternal: 'btnInternal', // Identifier for internal meeting panel button
  btnCVI: 'btnCVI', // Identifier for cvi meeting panel button
  btnWebRTC: 'btnWebRTC', // Identifier for WebRTC meeting panel button
  regexCvi: /^[0-9]{7,12}\b/, // Regex for matching valid cvi calls
  regexWebRtc: /^[0-9]{7,12}\b/, // Regex for matching valid WebRTC calls
};

exports.minVersion = '11.4.0.0';

if (tbOptions.definedTenants && tbOptions.definedTenants.length > 6) {
  logger.error('Too many tenants defined, init failed.');
  process.exit(1);
}

// Teams Button Class - Instantiated per Device
class TeamsButton {
  constructor(i, id, deviceId) {
    this.xapi = i.xapi;
    this.id = id;
    this.deviceId = deviceId;
    this.o = tbOptions;
    this.meetingId = false;
    this.meetingPassword = false;
    this.meetingTenant = false;
  }

  resetVariables() {
    this.meetingId = false;
    this.meetingPassword = false;
    this.meetingTenant = false;
  }

  async addPanel() {
    const config = await this.xapi.command(this.deviceId, 'UserInterface.Extensions.List');
    if (config.Extensions && config.Extensions.Panel) {
      const panelExist = config.Extensions.Panel.find(
        (panel) => panel.PanelId === this.o.panelId,
      );
      if (panelExist) {
        logger.debug(`${this.id}: Teams Panel already added`);
        return;
      }
    }

    if (this.o.logDetailed) logger.debug(`${this.id}: Adding Teams Panel`);
    let xml = `<?xml version="1.0"?>
    <Extensions>
    <Version>1.10</Version>
    <Panel>
      <Order>1</Order>
      <PanelId>${this.o.panelId}</PanelId>
      <Origin>local</Origin>
      <Location>HomeScreen</Location>
      <Icon>Custom</Icon>
      <Name>${this.o.buttonText}</Name>
      <ActivityType>Custom</ActivityType>
      <CustomIcon>
        <Content>${msIcon}</Content>
        <Id>607425258e2d4e4e89d1a04c502b4759b65045f1cb96ab9a848a18cb155ff721</Id>
      </CustomIcon>
      <Page>
        <Name>${this.o.panelTitle}</Name>
        <Row>
          <Name>Row</Name>
          <Widget>
            <WidgetId>${this.o.btnInternal}</WidgetId>
            <Name>${this.o.customerText}</Name>
            <Type>Button</Type>
            <Options>size=3</Options>
          </Widget>
        </Row>`;
    // Include Pre-defined Tenants
    if (this.o.definedTenants && this.o.definedTenants.length > 0) {
      xml += `
      <Row>`;
      this.o.definedTenants.forEach((tenant) => {
        xml += `
          <Widget>
            <WidgetId>${tenant.id}</WidgetId>
            <Name>${tenant.text}</Name>
            <Type>Button</Type>
            <Options>size=2</Options>
          </Widget>`;
      });
      xml += `
      </Row>`;
    }
    // Add External Header Row
    let title = 'External Microsoft Teams Meeting';
    if (this.o.externalCVI) title += ' Options';
    xml += `
        <Row>
          <Widget>
            <WidgetId>lblText</WidgetId>
            <Name>${title}</Name>
            <Type>Text</Type>
            <Options>size=4;fontSize=normal;align=center</Options>
          </Widget>
        </Row>`;
    // Include External CVI if enabled
    if (this.o.externalCVI) {
      xml += `
        <Row>
          <Widget>
            <WidgetId>${this.o.btnCVI}</WidgetId>
            <Name>External Meeting using Video Conference ID</Name>
            <Type>Button</Type>
            <Options>size=4</Options>
          </Widget>
        </Row>`;
    }
    // Add WebRTC Row
    xml += `
        <Row>
          <Widget>
            <WidgetId>${this.o.btnWebRTC}</WidgetId>
            <Name>External Meeting with Meeting ID and Password</Name>
            <Type>Button</Type>
            <Options>size=4</Options>
          </Widget>
        </Row>`;
    // Include External CVI footer note if enabled
    if (this.o.externalCVI) {
      xml += `
        <Row>
          <Widget>
            <WidgetId>text</WidgetId>
            <Name>The "Join with a video conferencing device" section of your Meeting Invite contains the Video Conference ID (if available)</Name>
            <Type>Text</Type>
            <Options>size=4;fontSize=small;align=center</Options>
          </Widget>
        </Row>`;
    }
    // Finalize UI Page
    xml += `
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel>
    </Extensions>`;

    await this.xapi.command(
      this.deviceId,
      'UserInterface.Extensions.Panel.Save',
      {
        PanelId: this.o.panelId,
      },
      xml,
    );
  }

  async removePanel() {
    const config = await this.xapi.command(this.deviceId, 'UserInterface.Extensions.List');
    if (config.Extensions && config.Extensions.Panel) {
      const panelExist = config.Extensions.Panel.find(
        (panel) => panel.PanelId === this.o.panelId,
      );
      if (!panelExist) {
        if (this.o.logDetailed) logger.debug(`${this.id}: Teams Panel does not exist`);
        return;
      }
    }

    if (this.o.logDetailed) logger.debug(`${this.id}: Removing Teams Panel`);
    await this.xapi.command(this.deviceId, 'UserInterface.Extensions.Panel.Close');
    await this.xapi.command(this.deviceId, 'UserInterface.Extensions.Panel.Remove', { PanelId: this.o.panelId });
  }

  showPrompt(id, overrideTitle = false) {
    let Title = 'Microsoft Teams Meeting';
    let InputType = 'Numeric';
    let SubmitText = 'Dial';
    let Placeholder;
    let Text;
    let FeedbackId;
    switch (id) {
      case 'internalId':
        Text = 'Enter the Video Conference ID';
        Placeholder = 'Video Conference ID';
        FeedbackId = this.o.feedbackInternalId;
        break;
      case 'conferenceId':
        Text = 'Enter the Video Conference ID';
        Placeholder = 'Video Conference ID';
        SubmitText = 'Next';
        FeedbackId = this.o.feedbackConferenceId;
        break;
      case 'tenantId':
        InputType = 'SingleLine';
        Text = 'Enter the Company Address from the Invite under<br>"Join with a video conferencing device"<br><br>eg. companyname@m.webex.com';
        Placeholder = 'companyname@m.webex.com';
        FeedbackId = this.o.feedbackTenant;
        break;
      case 'meetingId':
        Text = 'Enter the Meeting ID';
        Placeholder = 'Meeting ID';
        SubmitText = 'Next';
        FeedbackId = this.o.feedbackMeetingId;
        break;
      case 'meetingPassword':
        InputType = 'SingleLine';
        Text = 'Enter the Meeting Password';
        Placeholder = 'Meeting Password';
        FeedbackId = this.o.feedbackMeetingPassword;
        break;
      default:
        if (this.logUnknownResponses) logger.warn(`${this.id}: Unexpected showPrompt: ${id}`);
        return;
    }
    if (overrideTitle) {
      Title = overrideTitle;
    }
    try {
      this.xapi.command(this.deviceId, 'UserInterface.Message.TextInput.Display', {
        InputType,
        Placeholder,
        Title,
        Text,
        SubmitText,
        FeedbackId,
        Duration: this.o.promptTimeout,
      });
    } catch (error) {
      logger.error(`${this.id}: Error displaying TextInput`);
      logger.debug(`${this.id}: ${error.message}`);
    }
  }

  async placeCall(type) {
    switch (type) {
      case 'cvi':
        if (this.o.logDetailed) logger.debug(`${this.id}: attempting cvi: ${this.meetingId}.${this.meetingTenant}`);
        try {
          await this.xapi.command(this.deviceId, 'Dial', {
            Number: `${this.meetingId}.${this.meetingTenant}`,
          });
        } catch (error) {
          logger.error(`${this.id}: Error encountered dialling CVI call`);
          logger.debug(`${this.id}: ${error.message}`);
        }
        break;
      case 'webRtc':
        if (this.o.logDetailed) logger.debug(`attempting webRtc: ${this.meetingId}`);
        try {
          await this.xapi.command(this.deviceId, 'WebRTC.Join', { Type: 'MSTeams', MeetingNumber: this.meetingId, Passcode: this.meetingPassword });
        } catch (error) {
          if (error.message === 'This command needs a valid meeting url' || error.message.includes('valid meeting url')) {
            logger.debug(`${this.id}: Failed to connect with MS Meeting ID and Passcode, attempting URL Based Workaround`);
            try {
              const Url = `https://teams.microsoft.com/meet/${this.meetingId}?p=${this.meetingPassword}&webjoin=true&anon=true`;
              if (this.o.logDetailed) logger.log(`attempting url: ${Url}`);
              await this.xapi.command(this.deviceId, 'WebRTC.Join', { Type: 'MSTeams', MeetingNumber: this.meetingId, Url });
              return;
            } catch (err) {
              logger.error('error attempting webRtc url fallback call');
              logger.debug(err.message);
              await this.xapi.command(this.deviceId, 'UserInterface.Message.Prompt.Display', { Title: 'Error', Duration: 20, Text: 'Unable to dial, please contact IT Support' });
              return;
            }
          }
          logger.error(`${this.id}: error attempting webRtc call`);
          logger.debug(`${this.id}: ${error.message}`);
        }
        break;
      default:
        if (this.logUnknownResponses) logger.warn(`${this.id}: Unexpected placeCall: ${type}`);
    }
  }

  // Configure Cisco codec for Teams button
  async configureCodec() {
    try {
      const b = await this.xapi.config.get('UserInterface.Features.Call.JoinMicrosoftTeamsDirectGuestJoin');
      if (this.o.hideButton && b === 'Auto') {
        try {
          await this.xapi.config.set('UserInterface.Features.Call.JoinMicrosoftTeamsDirectGuestJoin', 'Hidden');
          logger.info(`${this.id}: Existing MS Teams button hidden.`);
        } catch (error) {
          logger.warn(`${this.id}: Unable to hide existing MS Teams button`);
        }
      }
    } catch (error) {
      // Ignore errors here as button may not exist on device.
    }
    // Process UI Changes
    if (this.o.rebuildUI) {
      if (this.o.logDetailed) logger.debug(`${this.id}: Rebuilding UI`);
      await this.removePanel();
    }
    await this.addPanel();
  }

  // ----- xAPI Handle Functions ----- //

  handleWidgetAction(event) {
    if (event.Type !== 'pressed') return;
    this.xapi.command(this.deviceId, 'UserInterface.Extensions.Panel.Close');
    switch (event.WidgetId) {
      case this.o.btnInternal:
        if (this.o.logDetailed) logger.debug(`${this.id}: Internal meeting selected`);
        this.meetingTenant = this.o.customerTenant;
        this.showPrompt('internalId');
        break;
      case this.o.btnCVI:
        if (this.o.logDetailed) logger.debug(`${this.id}: CVI meeting selected`);
        this.showPrompt('conferenceId');
        break;
      case this.o.btnWebRTC:
        if (this.o.logDetailed) logger.debug(`${this.id}: WebRTC meeting selected`);
        this.showPrompt('meetingId');
        break;
      default: {
        try {
          const [tenant] = this.o.definedTenants.filter((t) => t.id === event.WidgetId);
          if (this.o.logDetailed) logger.debug(`${this.id}: ${tenant.text} selected`);
          this.meetingTenant = tenant.tenant.toLowerCase();
          this.showPrompt('internalId');
          break;
        } catch (error) {
          if (this.logUnknownResponses) logger.warn(`${this.id}: Unexpected Widget.Action: ${event.FeedbackId}`);
        }
      }
    }
  }

  handleTextInputResponse(event) {
    switch (event.FeedbackId) {
      case this.o.feedbackInternalId:
        if (event.Text === '') {
          logger.warn(`${this.id}: Missing Internal Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('internalId', '⚠️ Missing Conference Id ⚠️');
          return;
        }
        if (!event.Text.match(this.o.regexCvi)) {
          logger.warn(`${this.id}: Invalid Internal Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('internalId', '⚠️ Invalid Conference Id ⚠️');
          return;
        }
        this.meetingId = event.Text;
        this.placeCall('cvi');
        break;
      case this.o.feedbackConferenceId:
        if (event.Text === '') {
          logger.warn(`${this.id}: Missing Conference Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('conferenceId', '⚠️ Missing Conference Id ⚠️');
          return;
        }
        if (!event.Text.match(this.o.regexCvi)) {
          logger.warn(`${this.id}: Invalid Conference Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('conferenceId', '⚠️ Invalid Conference Id ⚠️');
          return;
        }
        this.meetingId = event.Text;
        this.showPrompt('tenantId');
        break;
      case this.o.feedbackTenant: {
        let tenant = event.Text.toLowerCase();
        if (tenant === '') {
          logger.warn(`${this.id}: Missing Tenant, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('tenantId', '⚠️ Missing Tenant ⚠️');
          return;
        }
        if (!tenant.includes('@')) {
          tenant += this.o.defaultTenant;
        }
        this.meetingTenant = tenant;
        this.placeCall('cvi');
        break;
      }
      case this.o.feedbackMeetingId:
        if (event.Text === '') {
          logger.warn(`${this.id}: Missing Meeting Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('meetingId', '⚠️ Missing Meeting Id ⚠️');
          return;
        }
        if (!event.Text.match(this.o.regexWebRtc)) {
          logger.warn(`${this.id}: Invalid Meeting Id, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('meetingId', '⚠️ Invalid Meeting Id ⚠️');
          return;
        }
        this.meetingId = event.Text;
        this.showPrompt('meetingPassword');
        break;
      case this.o.feedbackMeetingPassword:
        if (event.Text === '') {
          logger.warn(`${this.id}: Missing Meeting Password, re-prompting user...`);
          this.xapi.command(this.deviceId, 'Audio.Sound.Play', { Sound: 'Binding' });
          this.showPrompt('meetingPassword', '⚠️ Missing Password Id ⚠️');
          return;
        }
        this.meetingPassword = event.Text;
        this.placeCall('webRtc');
        break;
      default:
        if (this.logUnknownResponses) logger.warn(`${this.id}: Unexpected TextInput.Response: ${event.FeedbackId}`);
    }
  }

  handleCallDisconnect() {
    if (this.o.logDetailed) logger.debug(`${this.id}: Reset Variables`);
    this.resetVariables();
  }

  handleTextInputTimeout(event) {
    switch (event.FeedbackId) {
      case this.o.feedbackInternalId:
      case this.o.feedbackConferenceId:
      case this.o.feedbackTenant:
      case this.o.feedbackMeetingId:
      case this.o.feedbackMeetingPassword:
        if (this.o.logDetailed) logger.debug(`${this.id}: Prompt timeout, resetting variables`);
        this.resetVariables();
        break;
      default:
        if (this.logUnknownResponses) logger.warn(`${this.id}: Unexpected Prompt.Cleared: ${event.FeedbackId}`);
    }
  }
}
exports.TeamsButton = TeamsButton;

const msIcon = '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';
