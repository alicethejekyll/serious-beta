let userCsrf='',adminCsrf='';
export function setCsrf(kind:'user'|'admin',value:string){if(kind==='user')userCsrf=value;else adminCsrf=value;}
export async function api<T=any>(url:string,method='GET',body?:unknown):Promise<T>{
 const res=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-CSRF-Token':url.startsWith('/api/admin')?adminCsrf:userCsrf})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');if(data.csrf)setCsrf(url.startsWith('/api/admin')?'admin':'user',data.csrf);return data;
}
export async function downloadExport(includeContacts:boolean){const data=await api('/api/admin/export','POST',{includeContacts,purpose:'manual_review'});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='renzhen-export.json';a.click();URL.revokeObjectURL(url);}
