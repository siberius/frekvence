/* Provider-independent local UI translation; no network requests. */
'use strict';
(() => {
 const english=window.WaveTranslations;
 const storageKey='frekvence-language';
 // Use the browser's primary language only on first use; an explicit choice wins.
 const browserLanguage=navigator.languages?.[0]||navigator.language||'en';
 let lang=/^cs(?:-|$)/i.test(browserLanguage)?'cs':'en';
 try {const saved=localStorage.getItem(storageKey);if(saved==='cs'||saved==='en')lang=saved;} catch {}
 const reverse=new Map(Object.entries(english).map(([cs,en])=>[en,cs]));
 function tr(input,...values){
  const key=Array.isArray(input)?input.reduce((out,part,i)=>out+part+(i<values.length?`{${i}}`:''),''):input;
  const translated=lang==='en'?(english[key]??key):key;
  return values.length?translated.replace(/\{(\d+)\}/g,(match,index)=>index<values.length?String(values[index]):match):translated;
 }
 const bindings=[];
 const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(node.parentElement.closest('script,style,noscript,#language-button'))continue;
  const key=node.textContent.trim();
  if(Object.hasOwn(english,key))bindings.push({node,key,before:node.textContent.match(/^\s*/)[0],after:node.textContent.match(/\s*$/)[0]});
 }
 document.querySelectorAll('[aria-label],[title],meta[name="description"],meta[name="apple-mobile-web-app-title"]').forEach(node=>{
  if(node.id==='language-button')return;
  for(const attribute of ['aria-label','title','content']){
   const key=node.getAttribute(attribute);
   if(key&&Object.hasOwn(english,key))bindings.push({node,key,attribute});
  }
 });
 function render(){
  document.documentElement.lang=lang;
  for(const {node,key,attribute,before,after} of bindings){
   if(!node.isConnected)continue;
   if(attribute)node.setAttribute(attribute,tr(key));else node.textContent=before+tr(key)+after;
  }
  const button=document.getElementById('language-button');
  button.textContent=lang==='cs'?'EN':'CS';
  button.lang=lang==='cs'?'en':'cs';
  const label=lang==='cs'?'Switch to English':'Přepnout do češtiny';
  button.setAttribute('aria-label',label);button.title=label;
 }
 function setLanguage(value){
  if(!['cs','en'].includes(value)||value===lang)return;
  lang=value;try{localStorage.setItem(storageKey,lang);}catch{}
  render();window.dispatchEvent(new Event('languagechange'));
 }
 window.WaveI18n={tr,language:()=>lang,locale:()=>lang==='cs'?'cs-CZ':'en-US',source:value=>reverse.get(value)??value,setLanguage};
 document.getElementById('language-button').onclick=()=>setLanguage(lang==='cs'?'en':'cs');
 render();
})();
