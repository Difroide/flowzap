const BASE = '/api'

async function req(method, path, body, isMultipart = false) {
  const opts = { method, headers: {} }
  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (body) {
    opts.body = body
  }
  const res = await fetch(BASE + path, opts)
  if (!res.ok) throw new Error(await res.text())
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const getInstances = () => req('GET', '/instances')
export const createInstance = (name) => req('POST', '/instances', { name })
export const getQr = (name) => req('GET', `/instances/${name}/qr`)
export const getInstanceStatus = (name) => req('GET', `/instances/${name}/status`)
export const deleteInstance = (name) => req('DELETE', `/instances/${name}`)

export const getFlows = () => req('GET', '/flows')
export const createFlow = (data) => req('POST', '/flows', data)
export const updateFlow = (id, data) => req('PUT', `/flows/${id}`, data)
export const deleteFlow = (id) => req('DELETE', `/flows/${id}`)
export const duplicateFlow = (id) => req('POST', `/flows/${id}/duplicate`)
export const getFullFlow = (id) => req('GET', `/flows/${id}/full`)
export const saveGraph = (id, data) => req('PUT', `/flows/${id}/graph`, data)

export const getContacts = () => req('GET', '/contacts')
export const resetContact = (id) => req('POST', `/contacts/${id}/reset`)
export const getContactMessages = (id) => req('GET', `/contacts/${id}/messages`)

export const uploadMedia = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return req('POST', '/media', fd, true)
}

export const getDashboardStats  = (params) => req('GET', `/dashboard/stats?${params}`)
export const getDashboardSales  = (params) => req('GET', `/dashboard/sales?${params}`)
export const getDashboardLeads  = (params) => req('GET', `/dashboard/leads?${params}`)
export const getDashboardConfig = ()       => req('GET', '/dashboard/config')
export const setDashboardConfig = (data)   => req('PUT', '/dashboard/config', data)

export const getChats         = ()                       => req('GET', '/chats')
export const getChatMessages  = (phone, instance)        => req('GET', `/chats/${encodeURIComponent(phone)}/${encodeURIComponent(instance)}`)
export const sendChatMessage  = (phone, instance, body)  => req('POST', `/chats/${encodeURIComponent(phone)}/${encodeURIComponent(instance)}/send`, { body })
export const markChatRead     = (phone, instance)        => req('POST', `/chats/${encodeURIComponent(phone)}/${encodeURIComponent(instance)}/mark-read`)
