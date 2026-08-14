local open = false
local pending = {}
local nextReq = 0

-- ---------------------------------------------------------------------------
-- Open / close
-- ---------------------------------------------------------------------------

RegisterNetEvent('codysql:open', function()
    if open then return end
    open = true
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'open', theme = GetResourceKvpString('codysql:theme') or 'midnight' })
end)

local function close()
    if not open then return end
    open = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'close' })
end

RegisterNUICallback('close', function(_, cb)
    close()
    cb({ ok = true })
end)

-- ---------------------------------------------------------------------------
-- Theme persistence (client-side KVP; never touches the server)
-- ---------------------------------------------------------------------------

RegisterNUICallback('setTheme', function(data, cb)
    if type(data.theme) == 'string' and #data.theme <= 32 then
        SetResourceKvp('codysql:theme', data.theme)
    end
    cb({ ok = true })
end)

-- ---------------------------------------------------------------------------
-- NUI <-> server bridge
-- The NUI posts { action, payload }; we relay to the server with a request id
-- and hold the NUI callback until the response event comes back.
-- ---------------------------------------------------------------------------

RegisterNUICallback('api', function(data, cb)
    nextReq += 1
    local reqId = nextReq
    pending[reqId] = cb
    TriggerServerEvent('codysql:api', data.action, data.payload, reqId)

    -- Safety timeout so a lost response never wedges the UI
    SetTimeout(30000, function()
        if pending[reqId] then
            pending[reqId]({ ok = false, error = 'Request timed out' })
            pending[reqId] = nil
        end
    end)
end)

RegisterNetEvent('codysql:apiResponse', function(reqId, result)
    local cb = pending[reqId]
    if cb then
        pending[reqId] = nil
        cb(result)
    end
end)
