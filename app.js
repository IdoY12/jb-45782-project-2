"use strict";

( async () => {
    const API_KEY = `f7aa5e2bda820656bb71b91c184d01a45a23129419eca618d22945b095ed5506`
    const CACHE_AGE_IN_SECONDS = 50009999999999999999
    const EUR_PER_USD = 0.91
    const ILS_PER_USD = 3.75
    const SAVED_COINS_KEY = `savedCoins`


    try {
        const priceHtml = usd => `
            USD ${usd.toFixed(4)}$ <br>
            EUR ${(usd * EUR_PER_USD).toFixed(4)}€ <br>
            ILS ${(usd * ILS_PER_USD).toFixed(4)}₪ <br>
            `


        const cardsGrid = document.getElementById(`cardsGrid`)
        const searchInput = document.getElementById(`searchInput`)

        const showSpinner = () => document.getElementById('loadingSpinner').style.display = 'block'
        const hideSpinner = () => document.getElementById('loadingSpinner').style.display = 'none'

        const getData = async (url, apiKey) => {
            showSpinner()
            try {
                const cacheHit = localStorage.getItem(url)
                if(cacheHit) {
                    const data = JSON.parse(cacheHit)
                    const { createdAt, data:dataHit } = data
                    if(createdAt + CACHE_AGE_IN_SECONDS * 1000 > Date.now()) return dataHit
                }
                const cacheMiss = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } }).then(res => res.json())
                localStorage.setItem(url, JSON.stringify({ data: cacheMiss, createdAt: Date.now() }))
                return cacheMiss
            }
            catch(err) {
                console.log(err)
            }
            finally {
                hideSpinner()
            }
        }



        const getLivePrice = (symbol, changePrice) => {
          showSpinner()
          try {
            const liveStream = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}usdt@ticker`)

            liveStream.onmessage = (event) => {
                const { c: closePrice } = JSON.parse(event.data)
                const price = parseFloat(closePrice)
                changePrice(price)
            }
          }
          catch(err){
            console.log(err)
          }
          finally{
            hideSpinner()
          }
        }


    
        const { data } = await getData(`https://rest.coincap.io/v3/assets`, API_KEY)
        const coinsAll = data.map(coin => ({
            ...coin,
            nameLC: coin.name.toLowerCase(),
            symbolLC: coin.symbol.toLowerCase()
        }))

        const loadSaved = () => JSON.parse(localStorage.getItem(SAVED_COINS_KEY) || `[]`)
        const saveToLocal = coinsArr => localStorage.setItem(SAVED_COINS_KEY, JSON.stringify(coinsArr))

        const selected = new Set(loadSaved())
        const isSelected = id => selected.has(id)

        const addSelected = id => {
                selected.add(id)
                saveToLocal([...selected])
        }

        const removeSelected = id => {
            selected.delete(id)
            saveToLocal([...selected])
        }

        
        const renderCards = coins => {
                cardsGrid.innerHTML = coins.map(({name, symbol, priceUsd, id}) => `
                    <div class="card text-center mb-3" style="width: 18rem;">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${name}
                            </h5>
                            <p class="card-text">
                                ${symbol}
                            </p>
                            <div class="form-check form-switch">
                                <input id="${id}" ${isSelected(id) ? `checked` : ``} class="switchCoin form-check-input" type="checkbox" role="switch">
                                <label class="form-check-label" for="${id}">
                                    Select coin
                                </label>
                            </div>
                            <button id="renderPrice_${symbol}" type="button" class="btn btn-secondary" data-bs-container="body"
                                data-bs-toggle="popover" data-bs-placement="bottom" data-bs-content="
                                ${priceHtml(+priceUsd)}
                                ">
                                More info
                            </button>
                        </div>
                    </div>
                `).join(``)
    
            document.querySelectorAll('[data-bs-toggle="popover"]').forEach(btn => {
                bootstrap.Popover.getOrCreateInstance(btn, {
                    container: 'body',
                    trigger: 'click',
                    html: true
                })
            
                btn.addEventListener('show.bs.popover', () => {
                    document.querySelectorAll('[data-bs-toggle="popover"]').forEach(otherBtn => {
                        if (otherBtn !== btn) {
                            const pop = bootstrap.Popover.getInstance(otherBtn)
                            if (pop) pop.hide()
                        }
                    })
                })
            })
        }
        renderCards(coinsAll)


        const updatePopover = (symbol, usd) => {
            const updatePriceHtml = priceHtml(usd)

            const btns = [
              document.getElementById(`renderPrice_${symbol}`),
              document.getElementById(`modalRenderPrice_${symbol}`)
            ].filter(Boolean)          

            btns.forEach(btn => {
              btn.setAttribute("data-bs-content", updatePriceHtml)

              const thePopUp = bootstrap.Popover.getOrCreateInstance(btn, {
                container: "body",
                trigger: "click",
                html: true
              })

              if (thePopUp.tip && thePopUp.tip.classList.contains(`show`)) {
                const popUpBody = thePopUp.tip.querySelector(`.popover-body`)
                if (popUpBody) popUpBody.innerHTML = updatePriceHtml
                thePopUp.update()
              }
            })
        }


        const onLivePrice = symbol => price => updatePopover(symbol, price)
        const wirePopoverLivePrices = () => {
          const btns = [
            ...document.querySelectorAll(`button[id^='renderPrice_']`),
            ...document.querySelectorAll(`button[id^='modalRenderPrice_']`)
          ]
        
          const symbols = [...new Set(btns.map(({id}) => id.replace(/^(renderPrice_|modalRenderPrice_)/, ``)))]
        
          symbols.forEach(symbol => {
            getLivePrice(symbol, onLivePrice(symbol))
          })
        }


        searchInput.addEventListener(`input`, () => {
            const userCoin = searchInput.value.trim().toLowerCase()
            if(!userCoin) {
                renderCards(coinsAll)
                return
            }
            const filtered = coinsAll.filter(({ nameLC, symbolLC }) => nameLC.startsWith(userCoin) || symbolLC.startsWith(userCoin))
            renderCards(filtered)
        })


        cardsGrid.addEventListener(`change`, (event) => {
            const swi = event.target
            const { id } = swi
            if(swi.checked) {
                if(selected.size < 5) addSelected(id)

                else {
                    swi.checked = false
                    openSwapModal(id)
                }
            } else {
                removeSelected(id)
            }
        })


        const buildSwapModal = () => {
            if(document.getElementById(`swapModal`)) return

            document.body.insertAdjacentHTML(`beforeend`, `
                    <div class="modal fade" id="swapModal" tabindex="-1" aria-labelledby="exampleModalLabel">
                        <div   class=" modal-dialog modal-dialog-scrollable">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h1 class="modal-title fs-5" id="exampleModalLabel">
                                        You can only select up to 5 coins
                                    </h1>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                    <div class="modal-body modal-body text-center">
                                        <div id="candidateCard"> </div>
                                        <h5>Please remove one selected coin to add a new one.</h5>
                                        <div id="selectedCards"> </div>
                                    </div>
                                <div class="modal-footer">
                                    <button id="cancelSwapBtn" type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                    <button id="confirmSwapBtn" type="button" class="btn btn-primary">Save changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `)
        }


        const getCoinById = id => coinsAll.find(({ id: coinId }) => coinId === id)
        let pendingNewId = null    


        const openSwapModal = newId => {
            buildSwapModal()
            pendingNewId = newId


            const closeAllBodyPopovers = () => {
              document.querySelectorAll('[data-bs-toggle="popover"]').forEach(btn => {
                const thePopUp = bootstrap.Popover.getInstance(btn)
                if (thePopUp) thePopUp.dispose()
              })
            }
            
            document.getElementById('swapModal').addEventListener('show.bs.modal', closeAllBodyPopovers)


            bootstrap.Modal.getOrCreateInstance(document.getElementById('swapModal')).show()


            const candidateCoin = getCoinById(pendingNewId)
            const { name, symbol, priceUsd, id } = candidateCoin
            const candidateCardHTML = `
                <div class="d-inline-block card text-center mb-3" style="width: 18rem;">
                    <div class="card-header bg-danger text-white">
                        <small>The coin you want to add</small>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">
                            ${name}
                        </h5>
                        <p class="card-text">
                            ${symbol}
                        </p>
                        <div class="form-check form-switch">
                            <input disabled id="candidateInput_${id}" class="form-check-input" type="checkbox" role="switch">
                            <label class="form-check-label" for="candidateInput_${id}">
                                Select coin
                            </label>
                        </div>
                    </div>
                </div>
            `
            document.getElementById(`candidateCard`).innerHTML = candidateCardHTML

            const selectedCoins = [...selected].map(getCoinById)
            const selectedCardsHTML = selectedCoins.map(({ name, symbol, priceUsd, id }) => 
                `
                    <div class="card d-inline-block text-center mb-3" style="width: 18rem;">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${name}
                            </h5>
                            <p class="card-text">
                                ${symbol}
                            </p>
                            <div class="form-check form-switch">
                                <input id="modalRemove_${id}" class="modalSwitchCoin form-check-input" type="checkbox" role="switch"  ${isSelected(id) ? 'checked' : ''}>
                                <label class="form-check-label" for="modalRemove_${id}">
                                    Remove this coin
                                </label>
                            </div>
                        </div>
                    </div>
                `
            ).join(``)
            document.getElementById(`selectedCards`).innerHTML = selectedCardsHTML

            const selectedCards = document.getElementById(`selectedCards`)
            const confirmSwapBtn = document.getElementById(`confirmSwapBtn`)
            const cancelSwapBtn = document.getElementById(`cancelSwapBtn`)

            confirmSwapBtn.disabled = true

            const handleChange = e => {
                const toggled = e.target
                selectedCards.querySelectorAll('.modalSwitchCoin').forEach(swi => {
                    if (swi !== toggled) swi.checked = true
                })
                confirmSwapBtn.disabled = toggled.checked
            }

            selectedCards.querySelectorAll('.modalSwitchCoin')
              .forEach(input => input.addEventListener('change', handleChange))

            confirmSwapBtn.onclick = () => {
                const chosen = selectedCards.querySelector('.modalSwitchCoin:not(:checked)')
                const removeId = chosen.id.replace('modalRemove_', '')
                removeSelected(removeId)
                addSelected(pendingNewId)
                bootstrap.Modal.getOrCreateInstance(document.getElementById('swapModal')).hide()
                pendingNewId = null
                const currentSearch = searchInput.value.trim().toLowerCase()
                const view = currentSearch
                    ? coinsAll.filter(({ nameLC, symbolLC }) => nameLC.startsWith(currentSearch) || symbolLC.startsWith(currentSearch))
                    : coinsAll
                renderCards(view)
            }
            
            cancelSwapBtn.onclick = () => pendingNewId = null
        }


//////////////////////////////////////////


        const MAX_POINT = 600
        const wsBySymbol = {}
        const CHART_COLORS = [
            '#3B82F6',
            '#EF4444',
            '#F59E0B',
            '#10B981',
            '#8B5CF6',
            '#F97316',
            '#06B6D4',
            '#84CC16',
            '#EC4899',
            '#6B7280'
        ]

        const getColorForDataset = index => {
            return CHART_COLORS[index % CHART_COLORS.length]
        }

        const ctx = document.getElementById('myChart');

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
              datasets: []
            },
            options: {
                interaction: { mode: 'nearest', intersect: false },
                parsing: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const t = items[0].parsed.x
                                const d = new Date(t)
                                const hh = String(d.getHours()).padStart(2,'0')
                                const mm = String(d.getMinutes()).padStart(2,'0')
                                const ss = String(d.getSeconds()).padStart(2,'0')
                                return `${hh}:${mm}:${ss}`
                            },
                            label: pointInfo => `${pointInfo.dataset.label}: $${pointInfo.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: `linear`,
                        ticks: {
                            autoSkip: true,
                            maxRotation: 0,
                            callback: (v) => {
                                const d = new Date(+v)
                                const hh = String(d.getHours()).padStart(2,`0`)
                                const mm = String(d.getMinutes()).padStart(2, `0`)
                                const ss = String(d.getSeconds()).padStart(2, `0`)
                                return `${hh}:${mm}:${ss}`
                            }
                        }
                    },
                    y: {
                        type: `logarithmic`
                    }
                }
            }
        });


        const addPointToChart = (symbol, price, timestamp) => {
            const { data: { datasets } } = chart
            const dataset = datasets.find(({ label }) => label === symbol)
            if(!dataset) return
            dataset.data.push({ x:timestamp, y: price })
            if(dataset.data.length > MAX_POINT) {
                dataset.data.splice(0, dataset.data.length - MAX_POINT)
            }
            chart.update(`none`)
            // console.log(symbol, price, new Date(timestamp).toLocaleTimeString())
        }


        const getLivePriceChart = (symbol, addPointToChart) => {
            showSpinner()
            try {
                const liveStream = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}usdt@ticker`)

                liveStream.onmessage = (event) => {
                    const { c: closePrice } = JSON.parse(event.data)
                    const price = parseFloat(closePrice)
                    if (!Number.isFinite(price)) return
                    const timestamp = Date.now()
                
                    addPointToChart(symbol, price, timestamp)
                }
                return liveStream
            }
            catch(err) {
              console.log(err)
            }
            finally {
                hideSpinner()
            }
        }


        const getSymbolsFromStorage = () => [
            ...new Set(
                loadSaved().map(getCoinById).filter(Boolean).map(({ symbol }) => symbol.toUpperCase())
            )
        ]


        const refreshChartFromStorage = () => {
            showSpinner()
            try {
                const { data: { datasets } } = chart
            
                const symbolsNow = getSymbolsFromStorage()
                const target = new Set(symbolsNow)

                const currentLabels = new Set(datasets.map(({ label }) => label))

                const removed = [...currentLabels].filter(label => !target.has(label))
                const added   = [...target].filter(label => !currentLabels.has(label))

                const removedSet = new Set(removed)
                const next = datasets.filter(ds => !removedSet.has(ds.label))
                datasets.splice(0, datasets.length, ...next)

                removed.forEach(label => {
                    const wsLive = wsBySymbol[label]
                    if(wsLive) {
                        wsLive.close()
                        delete wsBySymbol[label]
                    }
                })

                added.map((symbol, indexForColor) => {
                    const colorIndex = datasets.length + indexForColor
                    datasets.push({
                        label: symbol,
                        data: [],
                        borderColor: getColorForDataset(colorIndex),
                        backgroundColor: getColorForDataset(colorIndex),
                        borderWidth: 4,
                        pointRadius: 0,
                        tension: 0.2,
                        pointHitRadius: 12,
                        pointHoverRadius: 4
                    })
                    if(!wsBySymbol[symbol]) {
                        wsBySymbol[symbol] = getLivePriceChart(symbol, addPointToChart)
                    }
                })
                chart.update()
            } catch (err) {
                console.lof(err)
            }finally{
                hideSpinner()
            }
        }

        refreshChartFromStorage()

        const chartsTab = document.getElementById(`profile-tab`)
        chartsTab.addEventListener(`shown.bs.tab`, () => {
            refreshChartFromStorage()
        })


        document.addEventListener(`show.bs.tab`, () => {
            document.querySelectorAll(`[data-bs-toggle="popover"]`).forEach(btn => {
                const popover = bootstrap.Popover.getInstance(btn)
                if(popover) popover.hide()
            })
        })

        document.addEventListener('click', (e) => {
            document.querySelectorAll('[data-bs-toggle="popover"]').forEach(btn => {
                const pop = bootstrap.Popover.getInstance(btn)
                if (pop) {
                    if (!btn.contains(e.target) && !document.querySelector('.popover')?.contains(e.target)) {
                        pop.hide()
                    }
                }
            })
        })

        wirePopoverLivePrices()
    }
    catch(err){
        console.log(err)
    }

})()