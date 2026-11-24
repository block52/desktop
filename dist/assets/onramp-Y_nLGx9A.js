import{B as e,D as t,E as n,M as r,V as i,b as a,g as o,j as s,l as c,r as l,t as u,w as d,y as f}from"./ModalController-Sj-Y4eGs.js";import{t as p}from"./OnRampController-CBCdriPH.js";import{t as m}from"./wui-loading-thumbnail-BGZzYvef.js";import{b as h,c as g,g as _,l as v,o as y,s as b,v as x}from"./wui-text-DYVGWNva.js";import"./w3m-onramp-providers-footer-B_4qEh66.js";import"./wui-icon-CffO4VgU.js";import"./wui-link-CGqYmdmC.js";import"./wui-list-item-C1w5HhQ-.js";import"./wui-button-D5GWDGJH.js";import"./wui-icon-box-BaP5LkCe.js";import"./wui-loading-spinner-Dh-Be-Vr.js";import"./wui-visual-AGaJL3_X.js";import"./wui-input-text-Cg874gav.js";import"./wui-image-BJZFw2oP.js";var S=_`
  :host > wui-grid {
    max-height: 360px;
    overflow: auto;
  }

  wui-flex {
    transition: opacity ${({easings:e})=>e[`ease-out-power-1`]}
      ${({durations:e})=>e.md};
    will-change: opacity;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-flex.disabled {
    opacity: 0.3;
    pointer-events: none;
    user-select: none;
  }
`,C=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},w=class extends x{constructor(){super(),this.unsubscribe=[],this.selectedCurrency=p.state.paymentCurrency,this.currencies=p.state.paymentCurrencies,this.currencyImages=t.state.currencyImages,this.checked=m.state.isLegalCheckboxChecked,this.unsubscribe.push(p.subscribe(e=>{this.selectedCurrency=e.paymentCurrency,this.currencies=e.paymentCurrencies}),t.subscribeKey(`currencyImages`,e=>this.currencyImages=e),m.subscribeKey(`isLegalCheckboxChecked`,e=>{this.checked=e}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){let{termsConditionsUrl:e,privacyPolicyUrl:t}=r.state,n=r.state.features?.legalCheckbox,i=!!(e||t)&&!!n&&!this.checked;return h`
      <w3m-legal-checkbox></w3m-legal-checkbox>
      <wui-flex
        flexDirection="column"
        .padding=${[`0`,`3`,`3`,`3`]}
        gap="2"
        class=${y(i?`disabled`:void 0)}
      >
        ${this.currenciesTemplate(i)}
      </wui-flex>
    `}currenciesTemplate(e=!1){return this.currencies.map(t=>h`
        <wui-list-item
          imageSrc=${y(this.currencyImages?.[t.id])}
          @click=${()=>this.selectCurrency(t)}
          variant="image"
          tabIdx=${y(e?-1:void 0)}
        >
          <wui-text variant="md-medium" color="primary">${t.id}</wui-text>
        </wui-list-item>
      `)}selectCurrency(e){e&&(p.setPaymentCurrency(e),u.close())}};w.styles=S,C([b()],w.prototype,`selectedCurrency`,void 0),C([b()],w.prototype,`currencies`,void 0),C([b()],w.prototype,`currencyImages`,void 0),C([b()],w.prototype,`checked`,void 0),w=C([v(`w3m-onramp-fiat-select-view`)],w);var T=_`
  button {
    padding: ${({spacing:e})=>e[3]};
    border-radius: ${({borderRadius:e})=>e[4]};
    border: none;
    outline: none;
    background-color: ${({tokens:e})=>e.core.glass010};
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: ${({spacing:e})=>e[3]};
    transition: background-color ${({easings:e})=>e[`ease-out-power-1`]}
      ${({durations:e})=>e.md};
    will-change: background-color;
    cursor: pointer;
  }

  button:hover {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
  }

  .provider-image {
    width: ${({spacing:e})=>e[10]};
    min-width: ${({spacing:e})=>e[10]};
    height: ${({spacing:e})=>e[10]};
    border-radius: calc(
      ${({borderRadius:e})=>e[4]} - calc(${({spacing:e})=>e[3]} / 2)
    );
    position: relative;
    overflow: hidden;
  }

  .network-icon {
    width: ${({spacing:e})=>e[3]};
    height: ${({spacing:e})=>e[3]};
    border-radius: calc(${({spacing:e})=>e[3]} / 2);
    overflow: hidden;
    box-shadow:
      0 0 0 3px ${({tokens:e})=>e.theme.foregroundPrimary},
      0 0 0 3px ${({tokens:e})=>e.theme.backgroundPrimary};
    transition: box-shadow ${({easings:e})=>e[`ease-out-power-1`]}
      ${({durations:e})=>e.md};
    will-change: box-shadow;
  }

  button:hover .network-icon {
    box-shadow:
      0 0 0 3px ${({tokens:e})=>e.core.glass010},
      0 0 0 3px ${({tokens:e})=>e.theme.backgroundPrimary};
  }
`,E=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},D=class extends x{constructor(){super(...arguments),this.disabled=!1,this.color=`inherit`,this.label=``,this.feeRange=``,this.loading=!1,this.onClick=null}render(){return h`
      <button ?disabled=${this.disabled} @click=${this.onClick} ontouchstart>
        <wui-visual name=${y(this.name)} class="provider-image"></wui-visual>
        <wui-flex flexDirection="column" gap="01">
          <wui-text variant="md-regular" color="primary">${this.label}</wui-text>
          <wui-flex alignItems="center" justifyContent="flex-start" gap="4">
            <wui-text variant="sm-medium" color="primary">
              <wui-text variant="sm-regular" color="secondary">Fees</wui-text>
              ${this.feeRange}
            </wui-text>
            <wui-flex gap="2">
              <wui-icon name="bank" size="sm" color="default"></wui-icon>
              <wui-icon name="card" size="sm" color="default"></wui-icon>
            </wui-flex>
            ${this.networksTemplate()}
          </wui-flex>
        </wui-flex>
        ${this.loading?h`<wui-loading-spinner color="secondary" size="md"></wui-loading-spinner>`:h`<wui-icon name="chevronRight" color="default" size="sm"></wui-icon>`}
      </button>
    `}networksTemplate(){let e=l.getAllRequestedCaipNetworks()?.filter(e=>e?.assets?.imageId)?.slice(0,5);return h`
      <wui-flex class="networks">
        ${e?.map(e=>h`
            <wui-flex class="network-icon">
              <wui-image src=${y(n.getNetworkImage(e))}></wui-image>
            </wui-flex>
          `)}
      </wui-flex>
    `}};D.styles=[T],E([g({type:Boolean})],D.prototype,`disabled`,void 0),E([g()],D.prototype,`color`,void 0),E([g()],D.prototype,`name`,void 0),E([g()],D.prototype,`label`,void 0),E([g()],D.prototype,`feeRange`,void 0),E([g({type:Boolean})],D.prototype,`loading`,void 0),E([g()],D.prototype,`onClick`,void 0),D=E([v(`w3m-onramp-provider-item`)],D);var O=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},k=class extends x{constructor(){super(),this.unsubscribe=[],this.providers=p.state.providers,this.unsubscribe.push(p.subscribeKey(`providers`,e=>{this.providers=e}))}render(){return h`
      <wui-flex flexDirection="column" .padding=${[`0`,`3`,`3`,`3`]} gap="2">
        ${this.onRampProvidersTemplate()}
      </wui-flex>
    `}onRampProvidersTemplate(){return this.providers.filter(e=>e.supportedChains.includes(l.state.activeChain??`eip155`)).map(e=>h`
          <w3m-onramp-provider-item
            label=${e.label}
            name=${e.name}
            feeRange=${e.feeRange}
            @click=${()=>{this.onClickProvider(e)}}
            ?disabled=${!e.url}
            data-testid=${`onramp-provider-${e.name}`}
          ></w3m-onramp-provider-item>
        `)}onClickProvider(t){p.setSelectedProvider(t),a.push(`BuyInProgress`),i.openHref(p.state.selectedProvider?.url||t.url,`popupWindow`,`width=600,height=800,scrollbars=yes`),d.sendEvent({type:`track`,event:`SELECT_BUY_PROVIDER`,properties:{provider:t.name,isSmartAccount:o(l.state.activeChain)===e.ACCOUNT_TYPES.SMART_ACCOUNT}})}};O([b()],k.prototype,`providers`,void 0),k=O([v(`w3m-onramp-providers-view`)],k);var A=_`
  :host > wui-grid {
    max-height: 360px;
    overflow: auto;
  }

  wui-flex {
    transition: opacity ${({easings:e})=>e[`ease-out-power-1`]}
      ${({durations:e})=>e.md};
    will-change: opacity;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-flex.disabled {
    opacity: 0.3;
    pointer-events: none;
    user-select: none;
  }
`,j=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},M=class extends x{constructor(){super(),this.unsubscribe=[],this.selectedCurrency=p.state.purchaseCurrencies,this.tokens=p.state.purchaseCurrencies,this.tokenImages=t.state.tokenImages,this.checked=m.state.isLegalCheckboxChecked,this.unsubscribe.push(p.subscribe(e=>{this.selectedCurrency=e.purchaseCurrencies,this.tokens=e.purchaseCurrencies}),t.subscribeKey(`tokenImages`,e=>this.tokenImages=e),m.subscribeKey(`isLegalCheckboxChecked`,e=>{this.checked=e}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){let{termsConditionsUrl:e,privacyPolicyUrl:t}=r.state,n=r.state.features?.legalCheckbox,i=!!(e||t)&&!!n&&!this.checked;return h`
      <w3m-legal-checkbox></w3m-legal-checkbox>
      <wui-flex
        flexDirection="column"
        .padding=${[`0`,`3`,`3`,`3`]}
        gap="2"
        class=${y(i?`disabled`:void 0)}
      >
        ${this.currenciesTemplate(i)}
      </wui-flex>
    `}currenciesTemplate(e=!1){return this.tokens.map(t=>h`
        <wui-list-item
          imageSrc=${y(this.tokenImages?.[t.symbol])}
          @click=${()=>this.selectToken(t)}
          variant="image"
          tabIdx=${y(e?-1:void 0)}
        >
          <wui-flex gap="1" alignItems="center">
            <wui-text variant="md-medium" color="primary">${t.name}</wui-text>
            <wui-text variant="sm-regular" color="secondary">${t.symbol}</wui-text>
          </wui-flex>
        </wui-list-item>
      `)}selectToken(e){e&&(p.setPurchaseCurrency(e),u.close())}};M.styles=A,j([b()],M.prototype,`selectedCurrency`,void 0),j([b()],M.prototype,`tokens`,void 0),j([b()],M.prototype,`tokenImages`,void 0),j([b()],M.prototype,`checked`,void 0),M=j([v(`w3m-onramp-token-select-view`)],M);var N=_`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-visual {
    border-radius: calc(
      ${({borderRadius:e})=>e[1]} * 9 - ${({borderRadius:e})=>e[3]}
    );
    position: relative;
    overflow: hidden;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:e})=>e[1]} * -1);
    bottom: calc(${({spacing:e})=>e[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e[`ease-out-power-2`]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e[`ease-out-power-2`]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:e})=>e[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:e})=>e[`ease-out-power-2`]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  wui-link {
    padding: ${({spacing:e})=>e[`01`]} ${({spacing:e})=>e[2]};
  }
`,P=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},F=class extends x{constructor(){super(),this.unsubscribe=[],this.selectedOnRampProvider=p.state.selectedProvider,this.uri=c.state.wcUri,this.ready=!1,this.showRetry=!1,this.buffering=!1,this.error=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(p.subscribeKey(`selectedProvider`,e=>{this.selectedOnRampProvider=e}))}disconnectedCallback(){this.intervalId&&clearInterval(this.intervalId)}render(){let e=`Continue in external window`;this.error?e=`Buy failed`:this.selectedOnRampProvider&&(e=`Buy in ${this.selectedOnRampProvider?.label}`);let t=this.error?`Buy can be declined from your side or due to and error on the provider app`:`We’ll notify you once your Buy is processed`;return h`
      <wui-flex
        data-error=${y(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${[`10`,`5`,`5`,`5`]}
        gap="5"
      >
        <wui-flex justifyContent="center" alignItems="center">
          <wui-visual
            name=${y(this.selectedOnRampProvider?.name)}
            size="lg"
            class="provider-image"
          >
          </wui-visual>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${[`4`,`0`,`0`,`0`]}
        >
          <wui-text variant="md-medium" color=${this.error?`error`:`primary`}>
            ${e}
          </wui-text>
          <wui-text align="center" variant="sm-medium" color="secondary">${t}</wui-text>
        </wui-flex>

        ${this.error?this.tryAgainTemplate():null}
      </wui-flex>

      <wui-flex .padding=${[`0`,`5`,`5`,`5`]} justifyContent="center">
        <wui-link @click=${this.onCopyUri} color="secondary">
          <wui-icon size="sm" color="default" slot="iconLeft" name="copy"></wui-icon>
          Copy link
        </wui-link>
      </wui-flex>
    `}onTryAgain(){this.selectedOnRampProvider&&(this.error=!1,i.openHref(this.selectedOnRampProvider.url,`popupWindow`,`width=600,height=800,scrollbars=yes`))}tryAgainTemplate(){return this.selectedOnRampProvider?.url?h`<wui-button size="md" variant="accent" @click=${this.onTryAgain.bind(this)}>
      <wui-icon color="inherit" slot="iconLeft" name="refresh"></wui-icon>
      Try again
    </wui-button>`:null}loaderTemplate(){let e=f.state.themeVariables[`--w3m-border-radius-master`],t=e?parseInt(e.replace(`px`,``),10):4;return h`<wui-loading-thumbnail radius=${t*9}></wui-loading-thumbnail>`}onCopyUri(){if(!this.selectedOnRampProvider?.url){s.showError(`No link found`),a.goBack();return}try{i.copyToClopboard(this.selectedOnRampProvider.url),s.showSuccess(`Link copied`)}catch{s.showError(`Failed to copy`)}}};F.styles=N,P([b()],F.prototype,`intervalId`,void 0),P([b()],F.prototype,`selectedOnRampProvider`,void 0),P([b()],F.prototype,`uri`,void 0),P([b()],F.prototype,`ready`,void 0),P([b()],F.prototype,`showRetry`,void 0),P([b()],F.prototype,`buffering`,void 0),P([b()],F.prototype,`error`,void 0),P([g({type:Boolean})],F.prototype,`isMobile`,void 0),P([g()],F.prototype,`onRetry`,void 0),F=P([v(`w3m-buy-in-progress-view`)],F);var I=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},L=class extends x{render(){return h`
      <wui-flex
        flexDirection="column"
        .padding=${[`6`,`10`,`5`,`10`]}
        alignItems="center"
        gap="5"
      >
        <wui-visual name="onrampCard"></wui-visual>
        <wui-flex flexDirection="column" gap="2" alignItems="center">
          <wui-text align="center" variant="md-medium" color="primary">
            Quickly and easily buy digital assets!
          </wui-text>
          <wui-text align="center" variant="sm-regular" color="secondary">
            Simply select your preferred onramp provider and add digital assets to your account
            using your credit card or bank transfer
          </wui-text>
        </wui-flex>
        <wui-button @click=${a.goBack}>
          <wui-icon size="sm" color="inherit" name="add" slot="iconLeft"></wui-icon>
          Buy
        </wui-button>
      </wui-flex>
    `}};L=I([v(`w3m-what-is-a-buy-view`)],L);var R=_`
  :host {
    width: 100%;
  }

  wui-loading-spinner {
    position: absolute;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
  }

  .currency-container {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[2]};
    height: 40px;
    padding: ${({spacing:e})=>e[2]} ${({spacing:e})=>e[2]}
      ${({spacing:e})=>e[2]} ${({spacing:e})=>e[2]};
    min-width: 95px;
    border-radius: ${({borderRadius:e})=>e.round};
    border: 1px solid ${({tokens:e})=>e.theme.foregroundPrimary};
    background: ${({tokens:e})=>e.theme.foregroundPrimary};
    cursor: pointer;
  }

  .currency-container > wui-image {
    height: 24px;
    width: 24px;
    border-radius: 50%;
  }
`,z=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},B=class extends x{constructor(){super(),this.unsubscribe=[],this.type=`Token`,this.value=0,this.currencies=[],this.selectedCurrency=this.currencies?.[0],this.currencyImages=t.state.currencyImages,this.tokenImages=t.state.tokenImages,this.unsubscribe.push(p.subscribeKey(`purchaseCurrency`,e=>{e&&this.type!==`Fiat`&&(this.selectedCurrency=this.formatPurchaseCurrency(e))}),p.subscribeKey(`paymentCurrency`,e=>{e&&this.type!==`Token`&&(this.selectedCurrency=this.formatPaymentCurrency(e))}),p.subscribe(e=>{this.currencies=this.type===`Fiat`?e.purchaseCurrencies.map(this.formatPurchaseCurrency):e.paymentCurrencies.map(this.formatPaymentCurrency)}),t.subscribe(e=>{this.currencyImages={...e.currencyImages},this.tokenImages={...e.tokenImages}}))}firstUpdated(){p.getAvailableCurrencies()}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){let e=this.selectedCurrency?.symbol||``,t=this.currencyImages[e]||this.tokenImages[e];return h`<wui-input-text type="number" size="lg" value=${this.value}>
      ${this.selectedCurrency?h` <wui-flex
            class="currency-container"
            justifyContent="space-between"
            alignItems="center"
            gap="1"
            @click=${()=>u.open({view:`OnRamp${this.type}Select`})}
          >
            <wui-image src=${y(t)}></wui-image>
            <wui-text color="primary">${this.selectedCurrency.symbol}</wui-text>
          </wui-flex>`:h`<wui-loading-spinner></wui-loading-spinner>`}
    </wui-input-text>`}formatPaymentCurrency(e){return{name:e.id,symbol:e.id}}formatPurchaseCurrency(e){return{name:e.name,symbol:e.symbol}}};B.styles=R,z([g({type:String})],B.prototype,`type`,void 0),z([g({type:Number})],B.prototype,`value`,void 0),z([b()],B.prototype,`currencies`,void 0),z([b()],B.prototype,`selectedCurrency`,void 0),z([b()],B.prototype,`currencyImages`,void 0),z([b()],B.prototype,`tokenImages`,void 0),B=z([v(`w3m-onramp-input`)],B);var V=_`
  :host > wui-flex {
    width: 100%;
    max-width: 360px;
  }

  :host > wui-flex > wui-flex {
    border-radius: ${({borderRadius:e})=>e[8]};
    width: 100%;
  }

  .amounts-container {
    width: 100%;
  }
`,H=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},U={USD:`$`,EUR:`€`,GBP:`£`},W=[100,250,500,1e3],G=class extends x{constructor(){super(),this.unsubscribe=[],this.disabled=!1,this.caipAddress=l.state.activeCaipAddress,this.loading=u.state.loading,this.paymentCurrency=p.state.paymentCurrency,this.paymentAmount=p.state.paymentAmount,this.purchaseAmount=p.state.purchaseAmount,this.quoteLoading=p.state.quotesLoading,this.unsubscribe.push(l.subscribeKey(`activeCaipAddress`,e=>this.caipAddress=e),u.subscribeKey(`loading`,e=>{this.loading=e}),p.subscribe(e=>{this.paymentCurrency=e.paymentCurrency,this.paymentAmount=e.paymentAmount,this.purchaseAmount=e.purchaseAmount,this.quoteLoading=e.quotesLoading}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return h`
      <wui-flex flexDirection="column" justifyContent="center" alignItems="center">
        <wui-flex flexDirection="column" alignItems="center" gap="2">
          <w3m-onramp-input
            type="Fiat"
            @inputChange=${this.onPaymentAmountChange.bind(this)}
            .value=${this.paymentAmount||0}
          ></w3m-onramp-input>
          <w3m-onramp-input
            type="Token"
            .value=${this.purchaseAmount||0}
            .loading=${this.quoteLoading}
          ></w3m-onramp-input>
          <wui-flex justifyContent="space-evenly" class="amounts-container" gap="2">
            ${W.map(e=>h`<wui-button
                  variant=${this.paymentAmount===e?`accent-secondary`:`neutral-secondary`}
                  size="md"
                  textVariant="md-medium"
                  fullWidth
                  @click=${()=>this.selectPresetAmount(e)}
                  >${`${U[this.paymentCurrency?.id||`USD`]} ${e}`}</wui-button
                >`)}
          </wui-flex>
          ${this.templateButton()}
        </wui-flex>
      </wui-flex>
    `}templateButton(){return this.caipAddress?h`<wui-button
          @click=${this.getQuotes.bind(this)}
          variant="accent-primary"
          fullWidth
          size="lg"
          borderRadius="xs"
        >
          Get quotes
        </wui-button>`:h`<wui-button
          @click=${this.openModal.bind(this)}
          variant="accent"
          fullWidth
          size="lg"
          borderRadius="xs"
        >
          Connect wallet
        </wui-button>`}getQuotes(){this.loading||u.open({view:`OnRampProviders`})}openModal(){u.open({view:`Connect`})}async onPaymentAmountChange(e){p.setPaymentAmount(Number(e.detail)),await p.getQuote()}async selectPresetAmount(e){p.setPaymentAmount(e),await p.getQuote()}};G.styles=V,H([g({type:Boolean})],G.prototype,`disabled`,void 0),H([b()],G.prototype,`caipAddress`,void 0),H([b()],G.prototype,`loading`,void 0),H([b()],G.prototype,`paymentCurrency`,void 0),H([b()],G.prototype,`paymentAmount`,void 0),H([b()],G.prototype,`purchaseAmount`,void 0),H([b()],G.prototype,`quoteLoading`,void 0),G=H([v(`w3m-onramp-widget`)],G);export{F as W3mBuyInProgressView,k as W3mOnRampProvidersView,w as W3mOnrampFiatSelectView,M as W3mOnrampTokensView,G as W3mOnrampWidget,L as W3mWhatIsABuyView};